// lib/sse.ts
/**
 * Simple in-process SSE broadcaster.
 *
 * Works for single-instance deployments (Vercel serverless, Railway, Render, etc.)
 * For multi-instance you'd replace with Redis pub/sub — noted in README.
 */

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

// Global registry of open SSE connections
const clients = new Map<string, SSEClient>();

export function registerSSEClient(
  id: string,
  controller: ReadableStreamDefaultController
) {
  clients.set(id, { id, controller });
}

export function unregisterSSEClient(id: string) {
  clients.delete(id);
}

export function emitLeadUpdate(data: object) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  for (const client of clients.values()) {
    try {
      client.controller.enqueue(encoder.encode(message));
    } catch {
      // Client disconnected
      clients.delete(client.id);
    }
  }
}
