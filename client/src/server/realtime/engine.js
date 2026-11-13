import "server-only";
import { GameEngine } from "../engine/engine.js";
import { createIdentityResolver } from "../engine/auth.js";
import { createSupabasePersistence } from "../engine/persistence.js";
import { incrementStats, logActivity } from "../lib/activity.js";
import { guestsAllowed } from "../lib/guestAccess.js";
import { findOpenSessionForUser } from "../lib/lobby.js";
import { authorizeLobbyPlayer } from "../lib/membership.js";
import { supabase } from "../lib/supabase.js";

const globalStore = globalThis;

/**
 * One engine per Next.js server process. `next start` is a single long-lived
 * Node process, so rooms, timers, and SSE connections survive across requests.
 */
export function getEngine() {
  if (globalStore.__grouploreEngine) return globalStore.__grouploreEngine;

  const allowGuests = guestsAllowed();
  const engine = new GameEngine({
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
    findOpenSession: (connection) =>
      findOpenSessionForUser(connection.data.identity?.authUserId),
    persistence: createSupabasePersistence({
      supabase,
      logActivity,
      incrementStats,
    }),
  });

  globalStore.__grouploreEngine = engine;
  return engine;
}
