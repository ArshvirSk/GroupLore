import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { after, test } from "node:test";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";
import { GameEngine } from "../engine/engine.js";
import { createIdentityResolver } from "../engine/auth.js";

const sessions = new Map();
const tokenUsers = new Map();
tokenUsers.set("supabase-test-token", {
  id: "auth-user-1",
  email: "ada@example.com",
  user_metadata: { full_name: "Ada Lovelace" },
});
const sockets = [];
const persistence = {
  starts: [],
  ends: [],
  empties: [],
  lobbies: [],
  async onStart(payload) {
    this.starts.push(payload);
  },
  async onLobby(payload) {
    this.lobbies.push(payload);
  },
  async onEnd(payload) {
    this.ends.push(payload);
  },
  async onEmpty(payload) {
    this.empties.push(payload);
  },
};

const httpServer = createServer();
const ioServer = new Server(httpServer);
const engine = new GameEngine({
  io: ioServer,
  resolveIdentity: createIdentityResolver({
    verifyAccessToken: async (token) => tokenUsers.get(token) || null,
    allowGuests: true,
  }),
  authorize: async ({ identity }) => ({
    allowed: true,
    userId: identity.authUserId,
    name: identity.name,
    avatarUrl: null,
  }),
  loadSession: async (sessionId) => sessions.get(sessionId) || null,
  persistence,
  disconnectGraceMs: 500,
}).attach();

await new Promise((resolve) => httpServer.listen(0, resolve));
const port = httpServer.address().port;

function makeSession() {
  const id = randomUUID();
  sessions.set(id, { id, group_id: "00000000-0000-4000-8000-000000000001", status: "lobby" });
  return id;
}

function waitFor(socket, event, predicate = () => true, timeout = 4000) {
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

function makeTracker(socket) {
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

function waitSync(tracker, predicate = () => true, timeout = 4000) {
  if (tracker.latest && predicate(tracker.latest)) {
    return Promise.resolve(tracker.latest);
  }
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve };
    tracker.waiters.push(waiter);
    setTimeout(() => {
      tracker.waiters = tracker.waiters.filter((item) => item !== waiter);
      reject(new Error("Timed out waiting for room sync"));
    }, timeout);
  });
}

async function makeClient(name, existingToken) {
  const token = existingToken || `token-${randomUUID()}`;
  if (!tokenUsers.has(token)) {
    tokenUsers.set(token, {
      id: randomUUID(),
      is_anonymous: true,
      user_metadata: { display_name: name },
    });
  }
  const socket = createClient(`http://localhost:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: { token, displayName: name },
  });
  sockets.push(socket);
  const tracker = makeTracker(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return { name, socket, tracker, token };
}

async function spectate(client, sessionId) {
  const joined = waitFor(client.socket, "room:spectate-joined");
  client.socket.emit("room:spectate", { sessionId });
  await joined;
  return waitSync(
    client.tracker,
    (view) => view.sessionId === sessionId && view.you === null,
  );
}

async function join(client, sessionId, reconnectToken) {
  const joined = waitFor(client.socket, "room:joined");
  client.socket.emit("room:join", { sessionId, reconnectToken });
  const payload = await joined;
  const view = await waitSync(
    client.tracker,
    (state) => state.players.some((player) => player.id === payload.playerId),
  );
  return { ...payload, view };
}

async function act(client, action, data = {}, predicate = () => true) {
  const before = client.tracker.latest?.version || 0;
  client.socket.emit("room:action", {
    action,
    data,
    eventId: randomUUID(),
  });
  return waitSync(
    client.tracker,
    (view) => view.version > before && predicate(view),
  );
}

async function send(client, type, data = {}, predicate = () => true) {
  const before = client.tracker.latest?.version || 0;
  client.socket.emit("game:event", {
    type,
    ...data,
    eventId: randomUUID(),
  });
  return waitSync(
    client.tracker,
    (view) => view.version > before && predicate(view),
  );
}

async function expectError(client, emit) {
  const error = waitFor(client.socket, "room:error");
  emit();
  return error;
}

async function readyAll(...clients) {
  for (const client of clients) {
    await act(client, "ready", { ready: true });
  }
}

async function startStub(sessionId, mode, count) {
  const clients = [];
  for (let index = 0; index < count; index += 1) {
    clients.push(await makeClient(`P${index + 1}`));
  }
  const joined = [];
  for (const client of clients) {
    joined.push(await join(client, sessionId));
  }
  const [host, ...rest] = clients;
  await readyAll(...rest);
  await act(
    host,
    "selectGame",
    { gameId: "engine-stub", mode },
    (view) => view.gameId === "engine-stub",
  );
  await act(host, "start", {}, (view) => view.phase === "playing");
  return { clients, joined, host, rest };
}

after(async () => {
  for (const socket of sockets) socket.disconnect();
  engine.close();
  ioServer.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

test("a Supabase access token resolves to the verified auth identity", async () => {
  const sessionId = makeSession();
  const socket = createClient(`http://localhost:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: { token: "supabase-test-token", displayName: "Spoofed Name" },
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  const tracker = makeTracker(socket);
  const joined = await join({ socket, tracker }, sessionId);
  const player = joined.view.players.find(
    (entry) => entry.id === joined.playerId,
  );

  assert.equal(player.name, "Ada Lovelace");
  socket.disconnect();
});

test("rejects a socket without a valid credential", async () => {
  const socket = createClient(`http://localhost:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: {},
  });
  sockets.push(socket);
  const error = await waitFor(socket, "connect_error", () => true, 2000);
  assert.equal(error.data?.code, "unauthorized");
  socket.disconnect();
});

test("host starts, host-only end, idempotent answers and results", async () => {
  const sessionId = makeSession();
  const a = await makeClient("A");
  const b = await makeClient("B");
  const c = await makeClient("C");

  const aJoined = await join(a, sessionId);
  await join(b, sessionId);
  await join(c, sessionId);

  const view = await waitSync(a.tracker, (state) => state.players.length === 3);
  assert.equal(view.players.length, 3);
  assert.equal(view.hostId, aJoined.playerId);
  assert.equal(view.phase, "lobby");

  // Any member can choose the game, but only the host may start it.
  await act(b, "selectGame", { gameId: "engine-stub", mode: "classic" });
  const startForbidden = await expectError(c, () => {
    c.socket.emit("room:action", {
      action: "start",
      data: {},
      eventId: randomUUID(),
    });
  });
  assert.equal(startForbidden.code, "host_only");
  const started = await act(a, "start", {}, (state) => state.phase === "playing");
  assert.equal(started.phase, "playing");
  assert.ok(started.endsAt > Date.now());
  assert.equal(persistence.starts.length, 1);

  // Duplicate eventId must not count twice.
  const firstId = randomUUID();
  a.socket.emit("game:event", {
    type: "answer",
    value: "one",
    eventId: firstId,
  });
  a.socket.emit("game:event", {
    type: "answer",
    value: "two",
    eventId: firstId,
  });
  await send(b, "answer", { value: "two" }, (view) => view.phase === "playing");
  c.socket.emit("game:event", {
    type: "answer",
    value: "three",
    eventId: randomUUID(),
  });
  const reveal = await waitSync(
    c.tracker,
    (view) => view.game?.phase === "reveal",
  );
  assert.equal(reveal.game.phase, "reveal");
  assert.equal(reveal.game.reveal.answers.length, 3);
  const aAnswer = reveal.game.reveal.answers.find(
    (answer) => answer.playerId === aJoined.playerId,
  );
  assert.equal(aAnswer.value, "one");

  // Non-host cannot end the game.
  const endForbidden = await expectError(b, () => {
    b.socket.emit("room:action", {
      action: "end",
      data: {},
      eventId: randomUUID(),
    });
  });
  assert.equal(endForbidden.code, "host_only");

  const results = await act(a, "end", {}, (state) => state.phase === "results");
  assert.equal(results.phase, "results");
  assert.equal(results.result.ranking.length, 3);
  assert.equal(results.result.ranking[0].score, 1);
  assert.equal(persistence.ends.length, 1);

  const lobby = await act(a, "restart", {}, (state) => state.phase === "lobby");
  assert.equal(lobby.phase, "lobby");
  assert.equal(lobby.players.every((player) => !player.ready), true);
  assert.equal(persistence.lobbies.length, 1);
});

test("a refreshed player reclaims the same seat and private state", async () => {
  const sessionId = makeSession();
  const { clients, joined, host } = await startStub(sessionId, "classic", 3);
  const [a, b, c] = clients;

  await send(a, "answer", { value: "alpha" });
  await send(b, "answer", { value: "beta" });

  const rejoined = await makeClient("B", b.token);
  const seat = await join(rejoined, sessionId, joined[1].reconnectToken);

  assert.equal(seat.playerId, joined[1].playerId);
  assert.equal(seat.view.players.length, 3);
  assert.equal(seat.view.game.answeredByMe, true);

  c.socket.emit("game:event", {
    type: "answer",
    value: "gamma",
    eventId: randomUUID(),
  });
  const reveal = await waitSync(
    c.tracker,
    (view) => view.game?.phase === "reveal",
  );
  assert.equal(reveal.game.reveal.answers.length, 3);
  await act(host, "end");
  rejoined.socket.disconnect();
});

test("server timers advance a round without any client action", async () => {
  const sessionId = makeSession();
  const { host } = await startStub(sessionId, "timer", 2);

  const reveal = await waitSync(
    host.tracker,
    (view) => view.game?.phase === "reveal",
    3000,
  );
  assert.equal(reveal.phase, "playing");

  const results = await waitSync(
    host.tracker,
    (view) => view.phase === "results",
    3000,
  );
  assert.ok(results.result);
});

test("most likely to scores the plurality and hides voters in anonymous mode", async () => {
  const sessionId = makeSession();
  const a = await makeClient("A");
  const b = await makeClient("B");
  const c = await makeClient("C");
  const aJoined = await join(a, sessionId);
  const bJoined = await join(b, sessionId);
  await join(c, sessionId);

  await readyAll(b, c);
  await act(a, "selectGame", { gameId: "most-likely-to", mode: "classic" });
  await act(a, "start", {}, (view) => view.phase === "playing");

  // Self-votes are rejected.
  const selfVote = await expectError(a, () => {
    a.socket.emit("game:event", {
      type: "vote",
      targetPlayerId: aJoined.playerId,
      eventId: randomUUID(),
    });
  });
  assert.equal(selfVote.code, "cannot_vote_self");

  await send(a, "vote", { targetPlayerId: bJoined.playerId });
  await send(c, "vote", { targetPlayerId: bJoined.playerId });
  b.socket.emit("game:event", {
    type: "vote",
    targetPlayerId: aJoined.playerId,
    eventId: randomUUID(),
  });
  const reveal = await waitSync(
    b.tracker,
    (view) => view.game?.phase === "reveal",
  );

  assert.equal(reveal.game.phase, "reveal");
  assert.deepEqual(reveal.game.reveal.topPlayerIds, [bJoined.playerId]);
  assert.equal(reveal.game.reveal.voters.length, 3);
  const scores = Object.fromEntries(
    reveal.scores.map((entry) => [entry.playerId, entry.score]),
  );
  assert.equal(scores[aJoined.playerId], 1);
  assert.equal(scores[c.tracker.latest.you.id], 1);
  assert.equal(scores[bJoined.playerId], 0);

  await act(a, "end", {}, (view) => view.phase === "results");
  await act(a, "restart", {}, (view) => view.phase === "lobby");
  await readyAll(b, c);
  await act(a, "selectGame", { gameId: "most-likely-to", mode: "anonymous" });
  await act(a, "start", {}, (view) => view.phase === "playing");
  await send(a, "vote", { targetPlayerId: bJoined.playerId });
  await send(c, "vote", { targetPlayerId: bJoined.playerId });
  b.socket.emit("game:event", {
    type: "vote",
    targetPlayerId: aJoined.playerId,
    eventId: randomUUID(),
  });
  const anonymousReveal = await waitSync(
    b.tracker,
    (view) => view.game?.phase === "reveal",
  );
  assert.equal(anonymousReveal.game.reveal.voters, null);
});

test("a TV spectator never takes a seat and cannot act", async () => {
  const sessionId = makeSession();
  const a = await makeClient("A");
  const b = await makeClient("B");
  await join(a, sessionId);
  await join(b, sessionId);
  await readyAll(b);
  await act(a, "selectGame", { gameId: "engine-stub", mode: "classic" });

  const tv = await makeClient("TV");
  const lobby = await spectate(tv, sessionId);
  assert.equal(lobby.you, null);
  assert.equal(lobby.players.length, 2);

  const started = await act(a, "start", {}, (view) => view.phase === "playing");
  assert.equal(started.phase, "playing");
  const tvView = await waitSync(
    tv.tracker,
    (view) => view.phase === "playing",
  );
  assert.equal(tvView.you, null);
  assert.equal(tvView.game.phase, "answer");
  assert.equal(engine.rooms.get(sessionId).players.size, 2);
  assert.equal(engine.rooms.get(sessionId).spectators.size, 1);

  const forbidden = await expectError(tv, () => {
    tv.socket.emit("room:action", {
      action: "end",
      data: {},
      eventId: randomUUID(),
    });
  });
  assert.equal(forbidden.code, "not_in_room");

  await act(a, "end");
});

test("disconnecting beyond the grace period frees the room", async () => {
  const sessionId = makeSession();
  const a = await makeClient("A");
  const b = await makeClient("B");
  await join(a, sessionId);
  await join(b, sessionId);

  a.socket.disconnect();
  b.socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 800));

  assert.equal(engine.rooms.has(sessionId), false);
  assert.ok(persistence.empties.some((entry) => entry.room.id === sessionId));
});

test("hive mind plays over sockets with private answers until the reveal", async () => {
  const sessionId = makeSession();
  const a = await makeClient("A");
  const b = await makeClient("B");
  const c = await makeClient("C");
  const aJoined = await join(a, sessionId);
  const bJoined = await join(b, sessionId);
  const cJoined = await join(c, sessionId);
  const joined = [aJoined, bJoined, cJoined];

  await readyAll(b, c);
  await act(
    a,
    "selectGame",
    { gameId: "hive-mind", mode: "classic" },
    (view) => view.gameId === "hive-mind",
  );
  await act(a, "start", {}, (view) => view.game?.phase === "answer");

  // Each player only sees their own answer during the answering phase.
  const before = await waitSync(
    b.tracker,
    (view) => view.game?.phase === "answer",
  );
  assert.equal(before.game.youSubmitted, false);
  assert.equal("groups" in before.game, false);

  const sent = await Promise.all(
    [a, b, c].map((client, index) =>
      send(
        client,
        "answer",
        { value: index === 2 ? "burger" : "Pizza" },
        (view) => view.game?.phase === "reveal",
      ),
    ),
  );
  const latest = sent[sent.length - 1];

  assert.equal(latest.game.groups.length, 2);
  const pizza = latest.game.groups.find(
    (group) => group.answer.trim().toLowerCase() === "pizza",
  );
  assert.equal(pizza.points, 2);
  assert.equal(latest.scores.find((entry) => entry.playerId === aJoined.playerId).score, 2);
  assert.equal(latest.scores.find((entry) => entry.playerId === cJoined.playerId).score, 0);

  // The TV sees the reveal but never a player's private answer identity.
  const tv = await makeClient("TV");
  const tvView = await spectate(tv, sessionId);
  assert.equal(tvView.you, null);
  assert.equal(tvView.game.phase, "reveal");
  assert.equal(JSON.stringify(tvView.game).includes(cJoined.playerId), false);
  assert.equal(joined.length, 3);

  await act(a, "end");
});

test("host transfer goes to the longest-connected remaining player", async () => {
  const sessionId = makeSession();
  const a = await makeClient("A");
  const b = await makeClient("B");
  const c = await makeClient("C");
  await join(a, sessionId);
  const bJoined = await join(b, sessionId);
  await join(c, sessionId);

  a.socket.disconnect();
  const view = await waitSync(
    b.tracker,
    (state) => state.hostId === bJoined.playerId,
    2000,
  );
  assert.equal(view.hostId, bJoined.playerId);
  b.socket.disconnect();
  c.socket.disconnect();
});

test("a client-supplied playerId cannot spoof a game event author", async () => {
  const sessionId = makeSession();
  const { clients, joined } = await startStub(sessionId, "classic", 3);
  const [a, b, c] = clients;
  const [aJoined, bJoined, cJoined] = joined;

  a.socket.emit("game:event", {
    type: "answer",
    value: "spoofed",
    playerId: bJoined.playerId,
    eventId: randomUUID(),
  });
  await send(b, "answer", { value: "bravo" });
  await send(c, "answer", { value: "charlie" });

  const reveal = await waitSync(
    a.tracker,
    (view) => view.game?.phase === "reveal",
  );
  const spoof = reveal.game.reveal.answers.find(
    (answer) => answer.value === "spoofed",
  );
  assert.equal(spoof.playerId, aJoined.playerId);
  assert.notEqual(spoof.playerId, bJoined.playerId);
  assert.equal(cJoined.playerId.length > 0, true);
});
