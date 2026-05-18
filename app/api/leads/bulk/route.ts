// app/api/leads/bulk/route.ts
/**
 * Test-only endpoint. Generates up to 10 leads simultaneously
 * to verify concurrency handling and allocation correctness.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { allocateLead } from "@/lib/allocate";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const count: number = Math.min(Number(body.count ?? 10), 10);

  // Get all services
  const services = await prisma.service.findMany();
  if (services.length === 0) {
    return NextResponse.json({ error: "No services found. Run seed first." }, { status: 500 });
  }

  const results: { leadId: number; service: string; status: string }[] = [];

  // Fire all lead creations simultaneously
  await Promise.allSettled(
    Array.from({ length: count }, async (_, i) => {
      const service = services[i % services.length];
      // Use unique phone numbers to avoid duplicate constraint
      const phone = `TEST${Date.now()}${i}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);

      try {
        const lead = await prisma.lead.create({
          data: {
            name: `Bulk Test User ${i + 1}`,
            phone,
            city: "Test City",
            description: "Bulk concurrency test lead",
            serviceId: service.id,
          },
        });

        await allocateLead(lead.id, service.name);
        results.push({ leadId: lead.id, service: service.name, status: "ok" });
      } catch (err) {
        results.push({
          leadId: -1,
          service: service.name,
          status: err instanceof Error ? err.message : "error",
        });
      }
    })
  );

  return NextResponse.json({ results });
}
