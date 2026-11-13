import "server-only";
import { getEngine } from "@/server/realtime/engine.js";
import { apiError, handleApi, readJson } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "room:join",
  "room:spectate",
  "room:leave",
  "room:action",
  "game:event",
  "room:sync-request",
]);

function bearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const token = bearerToken(request);
    if (!token) return apiError(401, "unauthorized", "Sign in to play");

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

    const body = await readJson(request);
    const connectionId = String(body.connectionId || "");
    const event = String(body.event || "");
    if (!connectionId || !ALLOWED_EVENTS.has(event)) {
      return apiError(400, "invalid_event", "Invalid realtime event");
    }

    const connection = engine.connections.get(connectionId);
    if (!connection) {
      return apiError(409, "connection_not_found", "Realtime connection is closed");
    }
    if (connection.data.identity?.authUserId !== identity.authUserId) {
      return apiError(403, "forbidden", "This connection belongs to another user");
    }

    connection.receive(event, body.payload || {});
    return new Response(null, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  });
}
