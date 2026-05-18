// app/api/webhook/route.ts
/**
 * Webhook endpoint simulating payment gateway subscription confirmation.
 *
 * Idempotency: Every call must include an `Idempotency-Key` header.
 * If that key has already been processed, return 200 immediately without
 * re-running the quota reset — preventing duplicate effects.
 *
 * Quota can ONLY be reset via this endpoint (not from normal UI).
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { emitLeadUpdate } from "@/lib/sse";

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get("Idempotency-Key");

  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Idempotency-Key header is required." },
      { status: 400 }
    );
  }

  // Check if already processed
  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return NextResponse.json(
      {
        status: "already_processed",
        message: "This webhook event has already been applied.",
        processedAt: existing.processedAt,
      },
      { status: 200 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // Body optional
  }

  const action = (body.action as string) ?? "reset_quota";

  if (action === "reset_quota") {
    await prisma.$transaction(async (tx) => {
      // Reset all providers' leadsReceived to 0, quota back to 10
      await tx.provider.updateMany({
        data: { leadsReceived: 0, monthlyQuota: 10 },
      });

      // Record webhook event to prevent re-processing
      await tx.webhookEvent.create({
        data: {
          idempotencyKey,
          payload: JSON.stringify(body),
        },
      });
    });

    // Notify dashboards
    emitLeadUpdate({ type: "quota_reset" });

    return NextResponse.json(
      { status: "success", message: "Provider quotas have been reset to 10." },
      { status: 200 }
    );
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
