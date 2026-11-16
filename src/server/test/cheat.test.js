import assert from "node:assert/strict";
import { test } from "node:test";
import cheat from "../games/cheat.js";

function makeRoom(count = 3, mode = "classic") {
  const players = new Map();
  for (let index = 1; index <= count; index += 1) {
    players.set(`p${index}`, {
      id: `p${index}`,
      name: `Player ${index}`,
      connected: true,
      joinedAt: index,
    });
  }
  return {
    id: `cheat-${count}-${mode}`,
    mode,
    players,
    scores: Object.fromEntries([...players.keys()].map((id) => [id, 0])),
    state: null,
  };
}

const card = (rank, id) => ({ id, rank, value: 1 });

test("cheat deals the full deck and advances the claimed rank", () => {
  const room = makeRoom(3);
  const state = cheat.init(room, "classic");
  const total = Object.values(state.hands).reduce((sum, hand) => sum + hand.length, 0);
  assert.equal(total, 52);
  assert.equal(state.claimedRank, "A");
  const current = state.turnOrder[0];
  const first = state.hands[current][0];
  cheat.onEvent(room, current, { type: "play", cardIds: [first.id] });
  assert.equal(state.claimedRank, "2");
  assert.equal(state.pile.length, 1);
  assert.equal(state.lastPlay.claimedRank, "A");
});

test("quick mode uses a 30-card deck", () => {
  const room = makeRoom(3, "quick");
  const state = cheat.init(room, "quick");
  const total = Object.values(state.hands).reduce((sum, hand) => sum + hand.length, 0);
  assert.equal(total, 30);
});

test("a caught bluff makes the liar pick up the pile", () => {
  const room = makeRoom(3);
  const state = cheat.init(room, "classic");
  const [p1, p2] = state.turnOrder;
  state.turnIndex = 0;
  state.claimedRank = "K";
  state.hands[p1] = [card("Q", "lie"), card("A", "extra")];
  const before = state.hands[p1].length;
  cheat.onEvent(room, p1, { type: "play", cardIds: ["lie"] });
  cheat.onEvent(room, p2, { type: "call" });
  assert.equal(state.reveal.wasLie, true);
  assert.equal(state.reveal.pickerId, p1);
  cheat.onPhaseEnd(room);
  assert.equal(state.phase, "turn");
  assert.equal(state.hands[p1].length, before);
  assert.equal(state.pile.length, 0);
});

test("an honest claim makes the caller pick up the pile", () => {
  const room = makeRoom(3);
  const state = cheat.init(room, "classic");
  const [p1, p2] = state.turnOrder;
  state.turnIndex = 0;
  state.claimedRank = "K";
  state.hands[p1] = [card("K", "honest"), card("A", "extra")];
  cheat.onEvent(room, p1, { type: "play", cardIds: ["honest"] });
  cheat.onEvent(room, p2, { type: "call" });
  assert.equal(state.reveal.wasLie, false);
  assert.equal(state.reveal.pickerId, p2);
});

test("emptying a hand wins immediately", () => {
  const room = makeRoom(3);
  const state = cheat.init(room, "classic");
  const p1 = state.turnOrder[0];
  state.hands[p1] = [card("A", "last")];
  cheat.onEvent(room, p1, { type: "play", cardIds: ["last"] });
  assert.equal(state.done, true);
  assert.equal(room.scores[p1], 1000);
});

test("timeout plays the lowest card and hidden views do not leak", () => {
  const room = makeRoom(3);
  const state = cheat.init(room, "classic");
  const current = state.turnOrder[0];
  state.hands[current] = [card("K", "high"), card("2", "low")];
  cheat.onPhaseEnd(room);
  assert.equal(state.pile.length, 1);
  assert.equal(state.pile[0].id, "low");
  const publicView = JSON.stringify(cheat.publicFor(room));
  assert.equal(publicView.includes("high"), false);
  const own = cheat.viewFor(room, current);
  const otherId = state.turnOrder[1];
  assert.equal(JSON.stringify(own).includes(state.hands[otherId][0].id), false);
});
