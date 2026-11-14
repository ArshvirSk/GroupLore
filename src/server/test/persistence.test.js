import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabasePersistence } from "../engine/persistence.js";

function createFakeSupabase({ failures = {} } = {}) {
  const state = {
    game_sessions: {
      id: "session-1",
      status: "active",
      snapshot: { version: 1 },
      snapshot_updated_at: "2026-01-01T00:00:00.000Z",
    },
    lobbies: { id: "lobby-1", status: "in_game", closed_at: null },
  };
  const attempts = { game_sessions: 0, lobbies: 0 };

  const supabase = {
    from(table) {
      return {
        update(patch) {
          return {
            async eq(column, id) {
              attempts[table] += 1;
              if (state[table]?.[column] !== id) {
                return { error: { message: "not found" } };
              }
              if ((failures[table] || 0) > 0) {
                failures[table] -= 1;
                return { error: { message: `${table} unavailable` } };
              }
              Object.assign(state[table], patch);
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { supabase, state, attempts };
}

function makePersistence(fake, logs) {
  return createSupabasePersistence({
    supabase: fake.supabase,
    cleanupRetryDelayMs: 0,
    logger: {
      error: (...args) => logs.push(args),
    },
  });
}

function isRestorable(state) {
  return (
    state.game_sessions.status === "active" &&
    state.game_sessions.snapshot !== null &&
    state.lobbies.status === "in_game"
  );
}

test("cleanup cannot leave a restored room restorable when one write fails", async () => {
  const sessionFailure = createFakeSupabase({
    failures: { game_sessions: 3 },
  });
  const sessionLogs = [];
  await makePersistence(sessionFailure, sessionLogs).onEmpty({
    room: { id: "session-1", lobbyId: "lobby-1" },
  });

  assert.equal(sessionFailure.attempts.game_sessions, 3);
  assert.equal(sessionFailure.state.game_sessions.status, "active");
  assert.equal(sessionFailure.state.lobbies.status, "closed");
  assert.equal(isRestorable(sessionFailure.state), false);
  assert.ok(
    sessionLogs.some((args) => String(args[0]).includes("session cleanup")),
  );

  const lobbyFailure = createFakeSupabase({ failures: { lobbies: 3 } });
  const lobbyLogs = [];
  await makePersistence(lobbyFailure, lobbyLogs).onEmpty({
    room: { id: "session-1", lobbyId: "lobby-1" },
  });

  assert.equal(lobbyFailure.attempts.lobbies, 3);
  assert.equal(lobbyFailure.state.game_sessions.status, "finished");
  assert.equal(lobbyFailure.state.game_sessions.snapshot, null);
  assert.equal(lobbyFailure.state.lobbies.status, "in_game");
  assert.equal(isRestorable(lobbyFailure.state), false);
  assert.ok(
    lobbyLogs.some((args) => String(args[0]).includes("lobby cleanup")),
  );
});