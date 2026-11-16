import assert from "node:assert/strict";
import { test } from "node:test";
import liarsBar from "../games/liarsBar.js";

function makeRoom(playerCount = 3) {
  const players = new Map();
  for (let index = 0; index < playerCount; index += 1) {
    const id = `p${index + 1}`;
    players.set(id, {
      id,
      name: `Player ${index + 1}`,
      connected: true,
      joinedAt: index + 1,
    });
  }
  return {
    id: `room-${playerCount}`,
    mode: "classic",
    players,
    scores: Object.fromEntries([...players.keys()].map((id) => [id, 0])),
    state: null,
    endsAt: null,
  };
}

function card(rank, id = rank) {
  return { id, rank, value: rank === "K" ? 13 : rank === "Q" ? 12 : 14 };
}

test("liars bar deals five cards and enforces legal plays", () => {
  const room = makeRoom(3);
  const state = liarsBar.init(room, "classic");
  assert.equal(state.phase, "turn");
  assert.equal(state.turnOrder.length, 3);
  assert.equal(Object.values(state.hands).every((hand) => hand.length === 5), true);
  assert.equal(state.pile.length, 0);

  const current = state.turnOrder[state.turnIndex];
  const other = state.turnOrder.find((id) => id !== current);
  assert.throws(
    () =>
      liarsBar.onEvent(room, other, {
        type: "play",
        cardIds: [state.hands[other][0].id],
      }),
    /Wait for your turn/,
  );
  const hand = state.hands[current];
  const tooMany = [...hand, ...hand].slice(0, 4).map((c) => c.id);
  assert.throws(
    () => liarsBar.onEvent(room, current, { type: "play", cardIds: tooMany }),
    /between one and three/,
  );
  liarsBar.onEvent(room, current, {
    type: "play",
    cardIds: [hand[0].id, hand[1].id],
  });
  assert.equal(state.pile.length, 2);
  assert.equal(state.lastPlay.count, 2);
});

test("jokers are wild and calls resolve against the last play", () => {
  const room = makeRoom(3);
  const state = liarsBar.init(room, "classic");
  const [p1, p2] = state.turnOrder;
  state.turnIndex = 0;
  state.hands[p1] = [card("Q", "lie-q")];
  state.hands[p2] = [card("K", "honest-k")];
  liarsBar.onEvent(room, p1, { type: "play", cardIds: ["lie-q"] });
  assert.equal(state.turnOrder[state.turnIndex], p2);
  liarsBar.onEvent(room, p2, { type: "call" });
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.wasLie, true);
  assert.equal(state.reveal.stamp, "Caught!");
  assert.equal(state.strikes[p1], 1);
});

test("an honest claim gives the caller the strike", () => {
  const room = makeRoom(3);
  const state = liarsBar.init(room, "classic");
  const [p1, p2] = state.turnOrder;
  state.turnIndex = 0;
  state.hands[p1] = [card("K", "honest-k")];
  liarsBar.onEvent(room, p1, { type: "play", cardIds: ["honest-k"] });
  liarsBar.onEvent(room, p2, { type: "call" });
  assert.equal(state.reveal.wasLie, false);
  assert.equal(state.reveal.stamp, "Honest!");
  assert.equal(state.strikes[p2], 1);
});

test("a joker-only claim is honest", () => {
  const room = makeRoom(3);
  const state = liarsBar.init(room, "classic");
  const [p1, p2] = state.turnOrder;
  state.turnIndex = 0;
  state.hands[p1] = [{ id: "joker", rank: "JOKER", joker: true, value: 15 }];
  liarsBar.onEvent(room, p1, { type: "play", cardIds: ["joker"] });
  liarsBar.onEvent(room, p2, { type: "call" });
  assert.equal(state.reveal.wasLie, false);
});

test("an empty hand must call and a timeout plays the lowest card", () => {
  const room = makeRoom(3);
  const state = liarsBar.init(room, "classic");
  const [p1, p2] = state.turnOrder;
  state.turnIndex = 0;
  state.hands[p1] = [];
  state.lastPlay = { playerId: p2, name: "Player 2", cards: [card("K", "old-k")], count: 1 };
  const view = liarsBar.viewFor(room, p1);
  assert.equal(view.mustCall, true);
  assert.throws(
    () => liarsBar.onEvent(room, p1, { type: "play", cardIds: [] }),
    /no cards/,
  );
  liarsBar.onEvent(room, p1, { type: "call" });
  assert.equal(state.phase, "reveal");

  const room2 = makeRoom(3);
  const state2 = liarsBar.init(room2, "classic");
  const current = state2.turnOrder[state2.turnIndex];
  state2.hands[current] = [card("A", "high-a"), card("Q", "low-q")];
  const before = state2.hands[current].length;
  liarsBar.onPhaseEnd(room2);
  assert.equal(state2.hands[current].length, before - 1);
  assert.equal(state2.pile.length, 1);
  assert.notEqual(state2.turnOrder[state2.turnIndex], current);
});

test("leaving returns cards to the deck and can end the game", () => {
  const room = makeRoom(3);
  const state = liarsBar.init(room, "classic");
  const leaving = state.turnOrder[1];
  const count = state.hands[leaving].length;
  const deckBefore = state.deck.length;
  room.players.delete(leaving);
  liarsBar.onPlayerLeave(room, leaving);
  assert.equal(state.hands[leaving], undefined);
  assert.equal(state.deck.length, deckBefore + count);

  room.players.delete(state.turnOrder[0]);
  liarsBar.onPlayerLeave(room, state.turnOrder[0]);
  assert.equal(state.done, true);
  assert.equal(room.scores[state.turnOrder[0]], 1000);
});

test("hidden hands never leak through player or public views", () => {
  const room = makeRoom(3);
  liarsBar.init(room, "classic");
  const [p1, p2] = [...room.players.keys()];
  const own = liarsBar.viewFor(room, p1);
  const publicView = liarsBar.publicFor(room);
  const serializedOwn = JSON.stringify(own);
  assert.ok(own.hand.every((entry) => entry.id));
  assert.equal(serializedOwn.includes(room.state.hands[p2][0].id), false);
  const serializedPublic = JSON.stringify(publicView);
  assert.equal(serializedPublic.includes(room.state.hands[p1][0].id), false);
  assert.equal(serializedPublic.includes(room.state.hands[p2][0].id), false);
});

test("classic elimination ends with placement scores", () => {
  const room = makeRoom(3);
  const state = liarsBar.init(room, "classic");
  const [p1, p2, p3] = state.turnOrder;
  state.eliminated = [p2];
  delete state.hands[p2];
  state.strikes[p3] = 2;
  state.turnOrder = [p3, p1];
  state.turnIndex = 1;
  state.tableRank = "K";
  state.lastPlay = {
    playerId: p3,
    name: "Player 3",
    cards: [card("Q", "lie-q")],
    count: 1,
  };
  state.pile = [card("Q", "lie-q")];
  liarsBar.onEvent(room, p1, { type: "call" });
  assert.equal(state.reveal.eliminated.some((entry) => entry.playerId === p3), true);
  liarsBar.onPhaseEnd(room);
  assert.equal(state.done, true);
  assert.equal(room.scores[p1], 1000);
});
