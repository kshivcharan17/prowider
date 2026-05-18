// app/api/sse/route.ts
import { NextRequest } from "next/server";
import { registerSSEClient, unregisterSSEClient } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      registerSSEClient(clientId, controller);

      // Send initial heartbeat
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "heartbeat" })}\n\n`
            )
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Clean up on disconnect
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unregisterSSEClient(clientId);
      });
    },
    cancel() {
      unregisterSSEClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
