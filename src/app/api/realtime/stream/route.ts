import "server-only";
import { SseConnection } from "@/server/realtime/connection.js";
import { getEngine } from "@/server/realtime/engine.js";
import { apiError } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function encodeFrame(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return apiError(401, "unauthorized", "Sign in to play");
  }

  const engine = getEngine();
  let identity;
  try {
    identity = await engine.resolveIdentity({
      handshake: { auth: { token } },
    });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    const code = err?.code === "guests_disabled" ? "guests_disabled" : "unauthorized";
    return apiError(code === "guests_disabled" ? 403 : 401, code, err.message || "Sign in to play");
  }

  const encoder = new TextEncoder();
  let connection: SseConnection;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeFrame(event, payload)));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // The client may already have aborted.
        }
      };

      connection = new SseConnection({ identity, send, close });
      send("realtime:ready", { connectionId: connection.id });
      engine.connect(connection);

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15_000);
      heartbeat.unref?.();

      const abort = () => {
        engine.disconnect(connection);
        close();
      };
      request.signal.addEventListener("abort", abort, { once: true });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (connection) engine.disconnect(connection);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
