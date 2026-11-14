import assert from "node:assert/strict";
import { test } from "node:test";
import { createSupabasePersistence } from "../engine/persistence.js";

function createFakeSupabase({ failures = {}, insertFailures = {} } = {}) {
  const state = {
    game_sessions: {
      id: "session-1",
      status: "active",
      snapshot: { version: 1 },
      snapshot_updated_at: "2026-01-01T00:00:00.000Z",
    },
    lobbies: {
      id: "lobby-1",
      status: "in_game",
      host_id: null,
      closed_at: null,
    },
  };
  const attempts = { game_sessions: 0, lobbies: 0 };
  const inserts = {};

  const supabase = {
    from(table) {
      return {
        insert(row) {
          inserts[table] = inserts[table] || [];
          inserts[table].push(row);
          if ((insertFailures[table] || 0) > 0) {
            insertFailures[table] -= 1;
            return Promise.resolve({
              error: { message: `${table} unavailable` },
            });
          }
          return Promise.resolve({ error: null });
        },
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

  return { supabase, state, attempts, inserts };
}

function makePersistence(fake, logs) {
  return createSupabasePersistence({
    supabase: fake.supabase,
    writeRetryDelayMs: 0,
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

test("onEnd retries a failed session finish", async () => {
  const fake = createFakeSupabase({ failures: { game_sessions: 1 } });
  const logs = [];

  await makePersistence(fake, logs).onEnd({
    room: { state: { round: 2 }, players: new Map() },
    sessionId: "session-1",
    groupId: null,
    gameId: "engine-stub",
    mode: "classic",
    ranking: [],
    scores: {},
    reason: "completed",
  });

  assert.equal(fake.attempts.game_sessions, 2);
  assert.equal(fake.state.game_sessions.status, "finished");
  assert.equal(fake.state.game_sessions.snapshot, null);
});

test("onLobby does not reset a session while its lobby stays in game", async () => {
  const lobbyFailure = createFakeSupabase({ failures: { lobbies: 3 } });
  lobbyFailure.state.game_sessions.status = "finished";
  lobbyFailure.state.game_sessions.snapshot = null;
  const lobbyLogs = [];

  await makePersistence(lobbyFailure, lobbyLogs).onLobby({
    room: { id: "session-1", lobbyId: "lobby-1" },
  });

  assert.equal(lobbyFailure.attempts.lobbies, 3);
  assert.equal(lobbyFailure.attempts.game_sessions, 0);
  assert.equal(lobbyFailure.state.lobbies.status, "in_game");
  assert.equal(lobbyFailure.state.game_sessions.status, "finished");
  assert.ok(
    lobbyLogs.some((args) => String(args[0]).includes("lobby reopen")),
  );

  const sessionFailure = createFakeSupabase({
    failures: { game_sessions: 3 },
  });
  sessionFailure.state.game_sessions.status = "finished";
  sessionFailure.state.game_sessions.snapshot = null;
  const sessionLogs = [];

  await makePersistence(sessionFailure, sessionLogs).onLobby({
    room: { id: "session-1", lobbyId: "lobby-1" },
  });

  assert.equal(sessionFailure.attempts.lobbies, 1);
  assert.equal(sessionFailure.state.lobbies.status, "open");
  assert.equal(sessionFailure.state.game_sessions.status, "finished");
  assert.ok(
    sessionLogs.some((args) =>
      String(args[0]).includes("session lobby reset"),
    ),
  );
});

test("onLobby retries a transient lobby failure before resetting the session", async () => {
  const fake = createFakeSupabase({ failures: { lobbies: 1 } });
  fake.state.game_sessions.status = "finished";
  fake.state.game_sessions.snapshot = null;

  await makePersistence(fake, []).onLobby({
    room: { id: "session-1", lobbyId: "lobby-1" },
  });

  assert.equal(fake.attempts.lobbies, 2);
  assert.equal(fake.attempts.game_sessions, 1);
  assert.equal(fake.state.lobbies.status, "open");
  assert.equal(fake.state.game_sessions.status, "lobby");
  assert.equal(fake.state.game_sessions.snapshot, null);
});

test("onStart only marks the lobby in game after the session starts", async () => {
  const sessionFailure = createFakeSupabase({
    failures: { game_sessions: 3 },
  });
  sessionFailure.state.game_sessions.status = "lobby";
  sessionFailure.state.game_sessions.snapshot = null;
  sessionFailure.state.lobbies.status = "open";
  const sessionLogs = [];

  await makePersistence(sessionFailure, sessionLogs).onStart({
    room: { lobbyId: "lobby-1", groupId: null, players: new Map(), hostId: null },
    gameId: "engine-stub",
    mode: "classic",
    sessionId: "session-1",
    groupId: null,
  });

  assert.equal(sessionFailure.attempts.game_sessions, 3);
  assert.equal(sessionFailure.attempts.lobbies, 0);
  assert.equal(sessionFailure.state.game_sessions.status, "lobby");
  assert.equal(sessionFailure.state.lobbies.status, "open");
  assert.ok(
    sessionLogs.some((args) => String(args[0]).includes("session start")),
  );

  const transientFailure = createFakeSupabase({
    failures: { game_sessions: 1 },
  });
  transientFailure.state.game_sessions.status = "lobby";
  transientFailure.state.game_sessions.snapshot = null;
  transientFailure.state.lobbies.status = "open";

  await makePersistence(transientFailure, []).onStart({
    room: { lobbyId: "lobby-1", groupId: null, players: new Map(), hostId: null },
    gameId: "engine-stub",
    mode: "classic",
    sessionId: "session-1",
    groupId: null,
  });

  assert.equal(transientFailure.attempts.game_sessions, 2);
  assert.equal(transientFailure.attempts.lobbies, 1);
  assert.equal(transientFailure.state.game_sessions.status, "active");
  assert.equal(transientFailure.state.lobbies.status, "in_game");
});

test("onHostChange retries a failed host update", async () => {
  const fake = createFakeSupabase({ failures: { lobbies: 1 } });
  const logs = [];

  await makePersistence(fake, logs).onHostChange({
    room: { lobbyId: "lobby-1" },
    hostId: "user-2",
  });

  assert.equal(fake.attempts.lobbies, 2);
  assert.equal(fake.state.lobbies.host_id, "user-2");
});

test("onReport writes the moderation record", async () => {
  const fake = createFakeSupabase();
  const logs = [];

  const saved = await makePersistence(fake, logs).onReport({
    sessionId: "session-1",
    groupId: "group-1",
    reporterUserId: "reporter-1",
    targetUserId: "target-1",
    reporterName: "Ada",
    targetName: "Grace",
    reason: "harassment",
  });

  assert.deepEqual(fake.inserts.moderation_reports, [
    {
      session_id: "session-1",
      group_id: "group-1",
      reporter_user_id: "reporter-1",
      target_user_id: "target-1",
      reporter_name: "Ada",
      target_name: "Grace",
      reason: "harassment",
    },
  ]);
  assert.equal(saved, true);
  assert.equal(logs.length, 0);
});

test("onReport returns false when the insert fails", async () => {
  const fake = createFakeSupabase({
    insertFailures: { moderation_reports: 1 },
  });
  const logs = [];

  const saved = await makePersistence(fake, logs).onReport({
    sessionId: "session-1",
    groupId: "group-1",
    reporterUserId: "reporter-1",
    targetUserId: "target-1",
    reporterName: "Ada",
    targetName: "Grace",
    reason: "harassment",
  });

  assert.equal(saved, false);
  assert.equal(fake.inserts.moderation_reports.length, 1);
  assert.ok(
    logs.some((args) => String(args[0]).includes("moderation report failed")),
  );
});
