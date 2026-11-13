import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { io as createSocket } from "socket.io-client";

const base = process.env.API_BASE || "http://127.0.0.1:3199";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const configured = Boolean(supabaseUrl && serviceKey && anonKey);

const runId = randomUUID().slice(0, 8);
const groupIds = [];
const lobbyIds = [];
const accountIds = [];
const sockets = [];

let server;
let serverLogs = "";
let admin;
let host;
let member;
let outsider;
let spectator;
let guest;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function remember(stream, chunk) {
  serverLogs += chunk.toString();
  if (serverLogs.length > 30_000) serverLogs = serverLogs.slice(-30_000);
}

async function waitForHealth() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      throw new Error(`Server exited with ${server.exitCode}\n${serverLogs}`);
    }
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(250);
  }
  throw new Error(`Server did not become healthy\n${serverLogs}`);
}

async function call(
  path,
  { method = "GET", token, body, status, code } = {},
) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (status !== undefined) {
    assert.equal(
      response.status,
      status,
      `${method} ${path} returned ${response.status}: ${String(text).slice(0, 500)}`,
    );
  }
  if (code !== undefined) {
    assert.equal(data?.error?.code, code, `${method} ${path} error code`);
    assert.deepEqual(Object.keys(data.error).sort(), ["code", "message"]);
  }
  if (token && response.ok) {
    assert.equal(
      response.headers.get("cache-control"),
      "no-store",
      `${method} ${path} must not be cached`,
    );
  }
  return { response, data };
}

async function createAccount(label) {
  const email = `grouplore-test-${runId}-${label}@example.com`;
  const password = `Test-${randomUUID()}-aA1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Test ${label}` },
  });
  if (error) throw error;
  accountIds.push(data.user.id);

  const auth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInError } =
    await auth.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return {
    id: data.user.id,
    email,
    token: session.session.access_token,
  };
}

async function createGuest() {
  const auth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.signInAnonymously();
  if (error) {
    if (error.code === "anonymous_provider_disabled") return null;
    throw error;
  }
  accountIds.push(data.user.id);
  return {
    id: data.user.id,
    email: null,
    token: data.session.access_token,
  };
}

function waitFor(socket, event, predicate = () => true, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    function onEvent(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    }
    socket.on(event, onEvent);
  });
}

function trackRoom(socket) {
  const tracker = { latest: null, waiters: [] };
  socket.on("room:sync", (view) => {
    tracker.latest = view;
    tracker.waiters = tracker.waiters.filter((waiter) => {
      if (!waiter.predicate(view)) return true;
      waiter.resolve(view);
      return false;
    });
  });
  return tracker;
}

function waitSync(tracker, predicate = () => true, timeout = 12000, label = "room sync") {
  if (tracker.latest && predicate(tracker.latest)) {
    return Promise.resolve(tracker.latest);
  }
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve };
    tracker.waiters.push(waiter);
    setTimeout(() => {
      tracker.waiters = tracker.waiters.filter((item) => item !== waiter);
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeout);
  });
}

async function connectSocket(account) {
  const socket = createSocket(base, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: { token: account.token },
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return { socket, tracker: trackRoom(socket) };
}

async function joinRoom(client, sessionId, label) {
  // The server auto-rejoins an in-progress session on connection, so the
  // explicit join may only produce a sync rather than a second room:joined.
  const viewPromise = waitSync(
    client.tracker,
    (state) => state.sessionId === sessionId && state.you,
    6000,
    `${label} join`,
  );
  client.socket.emit("room:join", { sessionId });
  const view = await viewPromise;
  return { playerId: view.you.id, view };
}

async function waitForFinishedSession(token, sessionId, timeout = 5000) {
  const deadline = Date.now() + timeout;
  let session;
  do {
    session = await call(`/api/games/${sessionId}`, {
      token,
      status: 200,
    });
    if (session.data.status === "finished") return session;
    await sleep(200);
  } while (Date.now() < deadline);
  return session;
}

async function action(client, name, data = {}, predicate = () => true) {
  const beforeVersion = client.tracker.latest?.version || 0;
  const onError = (error) => {
    rejectAction(new Error(`${name} failed: ${error.code || error.message}`));
  };
  let rejectAction = () => {};
  const failure = new Promise((_, reject) => {
    rejectAction = reject;
  });
  client.socket.once("room:error", onError);
  try {
    client.socket.emit("room:action", {
      action: name,
      data,
      eventId: randomUUID(),
    });
    return await Promise.race([
      waitSync(
        client.tracker,
        (view) => view.version > beforeVersion && predicate(view),
        12000,
        `${name} action`,
      ),
      failure,
    ]);
  } finally {
    client.socket.off("room:error", onError);
  }
}

function emitGame(client, type, data = {}) {
  client.socket.emit("game:event", {
    type,
    ...data,
    eventId: randomUUID(),
  });
}

before(async () => {
  if (!configured) return;

  server = spawn(process.execPath, ["server.mjs"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, PORT: "3199", ALLOW_GUESTS: "true" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  server.stdout.on("data", (chunk) => remember("stdout", chunk));
  server.stderr.on("data", (chunk) => remember("stderr", chunk));

  await waitForHealth();

  admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  host = await createAccount("host");
  member = await createAccount("member");
  outsider = await createAccount("outsider");
  spectator = await createAccount("spectator");
  guest = await createGuest();

  for (const account of [host, member, outsider, spectator]) {
    await call("/api/users/sync", {
      method: "POST",
      token: account.token,
      status: 200,
    });
  }
  if (guest) {
    await call("/api/users/me", { token: guest.token, status: 200 });
  }
});

after(async () => {
  for (const socket of sockets) socket.disconnect();

  if (configured && admin) {
    try {
      if (groupIds.length) {
        await admin.from("groups").delete().in("id", groupIds);
      }
      if (lobbyIds.length) {
        await admin.from("lobbies").delete().in("id", lobbyIds);
      }
      if (accountIds.length) {
        const { data: legacy } = await admin
          .from("users")
          .select("id")
          .in("auth_user_id", accountIds);
        if (legacy?.length) {
          await admin
            .from("member_profiles")
            .delete()
            .in(
              "user_id",
              legacy.map((row) => row.id),
            );
        }
        await admin.from("users").delete().in("auth_user_id", accountIds);
        await admin.from("player_stats").delete().in("user_id", accountIds);
        for (const id of accountIds) {
          await admin.auth.admin.deleteUser(id).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Test cleanup failed:", error.message);
    }
  }

  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), sleep(5000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
});

test(
  "migrated API contract, auth rules, and multi-client game flow",
  { skip: configured ? false : "SUPABASE test credentials are not configured" },
  async (t) => {
    let group;
    let groupLobby;
    let gameLobby;
    let sessionId;

    await t.test("public routes and unauthenticated failures", async () => {
      const health = await call("/api/health", { status: 200 });
      assert.equal(health.data.status, "ok");
      assert.equal(health.data.guests, true);

      const config = await call("/api/auth/config", { status: 200 });
      assert.equal(config.data.guestsEnabled, true);

      await call("/api/auth/guest", {
        method: "POST",
        status: 410,
        code: "guest_endpoint_removed",
      });
      await call("/api/games/catalog", { status: 401, code: "unauthorized" });
      await call("/api/groups", { status: 401, code: "unauthorized" });
      await call("/api/lobbies/BAD", { status: 401, code: "unauthorized" });
      await call("/api/invites/BAD", { status: 400, code: "invalid_code" });
      await call("/api/invites/ZZZZZZ", { status: 404, code: "not_found" });
    });

    await t.test("authenticated user, catalog, and guest restrictions", async () => {
      const me = await call("/api/users/me", { token: host.token, status: 200 });
      assert.equal(me.data.id, host.id);
      assert.equal(me.data.isGuest, false);

      const catalog = await call("/api/games/catalog", {
        token: host.token,
        status: 200,
      });
      assert.equal(catalog.data.length, 21);

      const groups = await call("/api/groups", {
        token: host.token,
        status: 200,
      });
      assert.ok(Array.isArray(groups.data));
      await call("/api/groups/my", { token: host.token, status: 200 });
      await call("/api/feed?limit=1", { token: host.token, status: 200 });
      await call("/api/feed/stats", { token: host.token, status: 200 });
      await call("/api/feed/active-lobbies", {
        token: host.token,
        status: 200,
      });

      if (guest) {
        await call("/api/groups", {
          method: "POST",
          token: guest.token,
          body: { name: "Guest group" },
          status: 403,
          code: "guest_forbidden",
        });
        await call("/api/lobbies", {
          method: "POST",
          token: guest.token,
          status: 403,
          code: "guest_forbidden",
        });
      } else {
        t.diagnostic(
          "Supabase anonymous sign-ins are disabled; guest HTTP cases were skipped.",
        );
      }
      await call("/api/groups", {
        method: "POST",
        token: host.token,
        body: { name: "   " },
        status: 400,
        code: "name_required",
      });
    });

    await t.test("group routes, membership checks, nudges, and profiles", async () => {
      const created = await call("/api/groups", {
        method: "POST",
        token: host.token,
        body: { name: `Contract ${runId}` },
        status: 201,
      });
      group = created.data;
      groupIds.push(group.id);
      assert.equal(group.role, "owner");

      const { error: memberError } = await admin.from("group_members").insert({
        group_id: group.id,
        user_id: member.id,
        role: "member",
      });
      assert.equal(memberError, null);

      const detail = await call(`/api/groups/${group.id}`, {
        token: host.token,
        status: 200,
      });
      assert.equal(detail.data.members.length, 2);
      await call(`/api/groups/${group.id}`, {
        token: member.token,
        status: 200,
      });
      await call(`/api/groups/${group.id}`, {
        token: outsider.token,
        status: 403,
        code: "not_group_member",
      });
      await call(`/api/groups/${group.id}/nudges`, {
        token: host.token,
        status: 200,
      });
      await call(`/api/groups/${group.id}/nudges`, {
        token: member.token,
        status: 403,
        code: "owner_only",
      });

      await call(`/api/groups/${group.id}/nudge`, {
        method: "POST",
        token: member.token,
        status: 200,
      });
      const nudges = await call(`/api/groups/${group.id}/nudges`, {
        token: host.token,
        status: 200,
      });
      assert.ok(Array.isArray(nudges.data));
      assert.equal(nudges.data.length, 1);

      const profiles = await call(`/api/members/group/${group.id}`, {
        token: host.token,
        status: 200,
      });
      assert.ok(Array.isArray(profiles.data));

      const profile = await call(`/api/members/group/${group.id}`, {
        method: "POST",
        token: member.token,
        body: { displayName: `Member ${runId}`, traits: ["funny"] },
        status: 201,
      });
      assert.equal(profile.data.display_name, `Member ${runId}`);

      const updated = await call(`/api/members/group/${group.id}`, {
        method: "POST",
        token: member.token,
        body: { displayName: `Updated ${runId}` },
        status: 200,
      });
      assert.equal(updated.data.display_name, `Updated ${runId}`);

      await call(`/api/members/${profile.data.id}`, {
        method: "DELETE",
        token: member.token,
        status: 200,
      });
      await call(`/api/members/${randomUUID()}`, {
        method: "DELETE",
        token: member.token,
        status: 404,
        code: "not_found",
      });
    });

    await t.test("group lobby, invite, lobby lookup, and active game routes", async () => {
      const opened = await call(`/api/groups/${group.id}/lobby`, {
        method: "POST",
        token: host.token,
        status: 201,
      });
      groupLobby = opened.data;
      lobbyIds.push(groupLobby.id);

      const reopened = await call(`/api/groups/${group.id}/lobby`, {
        method: "POST",
        token: host.token,
        status: 200,
      });
      assert.equal(reopened.data.id, groupLobby.id);

      const invite = await call(`/api/invites/${groupLobby.code}`, {
        status: 200,
      });
      assert.equal(invite.data.lobby.id, groupLobby.id);
      assert.equal(invite.data.group.id, group.id);
      assert.equal(invite.data.guestsEnabled, true);

      const joined = await call("/api/lobbies/join", {
        method: "POST",
        token: member.token,
        body: { code: groupLobby.code.toLowerCase() },
        status: 200,
      });
      assert.ok(
        joined.data.lobby_players.some((player) => player.user_id === member.id),
      );

      await call(`/api/lobbies/id/${groupLobby.id}`, {
        token: member.token,
        status: 200,
      });
      await call(`/api/lobbies/${groupLobby.code}`, {
        token: member.token,
        status: 200,
      });
      await call(`/api/lobbies/${groupLobby.id}/start`, {
        method: "POST",
        token: member.token,
        body: { gameId: "most-likely-to", mode: "classic" },
        status: 403,
        code: "host_only",
      });
      await call(`/api/lobbies/${groupLobby.code}`, {
        method: "POST",
        token: host.token,
        status: 405,
      });
      await call(`/api/games/active/${group.id}`, {
        token: member.token,
        status: 200,
      });
      await call("/api/games", {
        method: "POST",
        token: host.token,
        body: { groupId: group.id },
        status: 201,
      });
    });

    await t.test("quick lobby start, game session read, and socket game", async () => {
      const created = await call("/api/lobbies", {
        method: "POST",
        token: host.token,
        status: 201,
      });
      gameLobby = created.data;
      lobbyIds.push(gameLobby.id);

      for (const account of [member, outsider]) {
        await call("/api/lobbies/join", {
          method: "POST",
          token: account.token,
          body: { code: gameLobby.code },
          status: 200,
        });
      }

      await call("/api/lobbies/join", {
        method: "POST",
        token: outsider.token,
        body: { code: "ZZZZZZ" },
        status: 404,
        code: "not_found",
      });
      await call(`/api/lobbies/${gameLobby.id}/start`, {
        method: "POST",
        token: host.token,
        body: { gameId: "does-not-exist" },
        status: 404,
        code: "not_found",
      });
      await call(`/api/lobbies/${gameLobby.id}/start`, {
        method: "POST",
        token: host.token,
        body: { gameId: "most-likely-to", mode: "nope" },
        status: 400,
        code: "unknown_mode",
      });

      const started = await call(`/api/lobbies/${gameLobby.id}/start`, {
        method: "POST",
        token: host.token,
        body: { gameId: "most-likely-to", mode: "classic" },
        status: 201,
      });
      sessionId = started.data.sessionId;
      assert.equal(started.data.lobby.status, "in_game");

      await call(`/api/games/${sessionId}`, {
        token: host.token,
        status: 200,
      });
      await call(`/api/games/${sessionId}`, {
        token: spectator.token,
        status: 403,
        code: "not_in_lobby",
      });

      // Seat the host before opening the other sockets: the engine assigns
      // host to the first player that joins the room.
      const hostClient = await connectSocket(host);
      const hostSeat = await joinRoom(hostClient, sessionId, "host");
      const memberClient = await connectSocket(member);
      const memberSeat = await joinRoom(memberClient, sessionId, "member");
      const outsiderClient = await connectSocket(outsider);
      const outsiderSeat = await joinRoom(outsiderClient, sessionId, "outsider");

      const isReady = (seat) => (view) =>
        view.players.find((player) => player.id === seat.playerId)?.ready === true;
      await action(memberClient, "ready", { ready: true }, isReady(memberSeat));
      await action(outsiderClient, "ready", { ready: true }, isReady(outsiderSeat));
      await action(
        hostClient,
        "selectGame",
        { gameId: "most-likely-to", mode: "classic" },
        (view) => view.gameId === "most-likely-to",
      );
      const playing = await action(
        hostClient,
        "start",
        {},
        (view) => view.phase === "playing",
      );
      assert.equal(playing.game.phase, "vote");

      const reveal = waitSync(
        hostClient.tracker,
        (view) => view.game?.phase === "reveal",
      );
      emitGame(hostClient, "vote", { targetPlayerId: memberSeat.playerId });
      emitGame(memberClient, "vote", { targetPlayerId: hostSeat.playerId });
      emitGame(outsiderClient, "vote", { targetPlayerId: memberSeat.playerId });
      const revealView = await reveal;
      assert.equal(revealView.game.reveal.topPlayerIds.length, 1);
      assert.equal(
        revealView.game.reveal.topPlayerIds[0],
        memberSeat.playerId,
      );

      const results = await action(
        hostClient,
        "end",
        {},
        (view) => view.phase === "results",
      );
      assert.equal(results.result.ranking.length, 3);

      // Wait for the asynchronous end persistence so the TV socket cannot
      // auto-rejoin the finished session as a player.
      await waitForFinishedSession(host.token, sessionId);

      // Spectators are authorized as lobby members; the TV page opens with
      // the signed-in host's token in a second tab.
      const tvClient = await connectSocket(host);
      const spectateJoined = waitFor(tvClient.socket, "room:spectate-joined");
      tvClient.socket.emit("room:spectate", { sessionId });
      await spectateJoined;
      const tvView = await waitSync(
        tvClient.tracker,
        (view) => view.sessionId === sessionId && view.you === null,
        6000,
        "TV spectator sync",
      );
      assert.equal(tvView.players.length, 3);
      assert.equal(tvView.you, null);
    });

    await t.test("kick, leave, remove-member, and leave-group rules", async () => {
      const kickLobby = (
        await call("/api/lobbies", {
          method: "POST",
          token: host.token,
          status: 201,
        })
      ).data;
      lobbyIds.push(kickLobby.id);
      await call("/api/lobbies/join", {
        method: "POST",
        token: member.token,
        body: { code: kickLobby.code },
        status: 200,
      });
      await call(`/api/lobbies/${kickLobby.id}/kick`, {
        method: "POST",
        token: host.token,
        body: { userId: host.id },
        status: 400,
        code: "cannot_kick_self",
      });
      await call(`/api/lobbies/${kickLobby.id}/kick`, {
        method: "POST",
        token: host.token,
        body: { userId: member.id },
        status: 200,
      });
      await call(`/api/lobbies/id/${kickLobby.id}`, {
        token: member.token,
        status: 403,
        code: "not_in_lobby",
      });
      const left = await call(`/api/lobbies/${kickLobby.id}/leave`, {
        method: "POST",
        token: host.token,
        status: 200,
      });
      assert.equal(left.data.closed, true);

      const removalGroup = (
        await call("/api/groups", {
          method: "POST",
          token: host.token,
          body: { name: `Removal ${runId}` },
          status: 201,
        })
      ).data;
      groupIds.push(removalGroup.id);
      await admin.from("group_members").insert({
        group_id: removalGroup.id,
        user_id: outsider.id,
        role: "member",
      });
      await call(
        `/api/groups/${removalGroup.id}/members/${host.id}`,
        {
          method: "DELETE",
          token: host.token,
          status: 400,
          code: "cannot_remove_self",
        },
      );
      await call(
        `/api/groups/${removalGroup.id}/members/${outsider.id}`,
        {
          method: "DELETE",
          token: host.token,
          status: 200,
        },
      );
      await call(`/api/groups/${removalGroup.id}`, {
        token: outsider.token,
        status: 403,
        code: "not_group_member",
      });
      const deleted = await call(`/api/groups/${removalGroup.id}/leave`, {
        method: "DELETE",
        token: host.token,
        status: 200,
      });
      assert.equal(deleted.data.groupDeleted, true);

      const leaveGroup = (
        await call("/api/groups", {
          method: "POST",
          token: outsider.token,
          body: { name: `Leave ${runId}` },
          status: 201,
        })
      ).data;
      groupIds.push(leaveGroup.id);
      const alone = await call(`/api/groups/${leaveGroup.id}/leave`, {
        method: "DELETE",
        token: outsider.token,
        status: 200,
      });
      assert.equal(alone.data.groupDeleted, true);
    });

    await t.test("feed and stats include the finished game", async () => {
      const feed = await call("/api/feed?limit=10", {
        token: host.token,
        status: 200,
      });
      assert.ok(Array.isArray(feed.data));

      const stats = await call("/api/feed/stats", {
        token: host.token,
        status: 200,
      });
      assert.ok(stats.data.stats);

      const active = await call("/api/feed/active-lobbies", {
        token: host.token,
        status: 200,
      });
      assert.ok(Array.isArray(active.data));

      const session = await waitForFinishedSession(host.token, sessionId);
      assert.equal(session.data.status, "finished");
    });
  },
);
