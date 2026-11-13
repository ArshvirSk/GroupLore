import nextEnv from "@next/env";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const { loadEnvConfig } = nextEnv;

const dev = process.argv.includes("--dev");
const hostname = process.env.HOST || "0.0.0.0";
const configuredPort = Number(process.env.PORT);
const port =
  Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3000;

process.env.NODE_ENV ||= dev ? "development" : "production";
loadEnvConfig(process.cwd(), dev);

const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

await nextApp.prepare();

const { GameEngine } = await import("./src/server/engine/engine.js");
const { createIdentityResolver } = await import("./src/server/engine/auth.js");
const { createSupabasePersistence } = await import(
  "./src/server/engine/persistence.js"
);
const { incrementStats, logActivity } = await import(
  "./src/server/lib/activity.js"
);
const { guestsAllowed } = await import("./src/server/lib/guestAccess.js");
const { findOpenSessionForUser } = await import(
  "./src/server/lib/lobby.js"
);
const { authorizeLobbyPlayer } = await import(
  "./src/server/lib/membership.js"
);
const { supabase } = await import("./src/server/lib/supabase.js");

const httpServer = createServer((request, response) =>
  handle(request, response),
);
const io = new Server(httpServer);
const allowGuests = guestsAllowed();

const engine = new GameEngine({
  io,
  disconnectGraceMs: process.env.DISCONNECT_GRACE_MS
    ? Number(process.env.DISCONNECT_GRACE_MS)
    : undefined,
  resolveIdentity: createIdentityResolver({
    allowGuests,
    verifyAccessToken: async (token) => {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) return null;
      return data?.user || null;
    },
  }),
  authorize: ({ identity, lobbyId }) =>
    authorizeLobbyPlayer({ identity, lobbyId, allowGuests }),
  loadSession: async (sessionId) => {
    const { data } = await supabase
      .from("game_sessions")
      .select(
        "id, lobby_id, status, game_type, lobbies(id, code, group_id, status, groups(name))",
      )
      .eq("id", sessionId)
      .maybeSingle();
    return data || null;
  },
  findOpenSession: (socket) =>
    findOpenSessionForUser(socket.data.identity?.authUserId),
  persistence: createSupabasePersistence({
    supabase,
    logActivity,
    incrementStats,
  }),
});

engine.attach();
globalThis.__grouploreEngine = engine;

httpServer.listen(port, hostname, () => {
  console.log(`GroupLore running on http://${hostname}:${port}`);
});

function shutdown(signal) {
  console.log(`\n${signal} received — closing rooms`);
  engine.close();
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
