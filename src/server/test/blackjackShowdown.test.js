import assert from "node:assert/strict";
import { test } from "node:test";
import blackjackShowdown from "../games/blackjackShowdown.js";

function makeRoom() {
  const players = new Map();
  for (let index = 1; index <= 2; index += 1) {
    players.set(`p${index}`, {
      id: `p${index}`,
      name: `Player ${index}`,
      connected: true,
      joinedAt: index,
    });
  }
  return {
    id: "blackjack-room",
    mode: "classic",
    players,
    scores: { p1: 0, p2: 0 },
    state: null,
  };
}

const card = (rank, id, value) => ({ id, rank, value, suit: "S" });

test("blackjack deals, takes the ante, and hides the hole card", () => {
  const room = makeRoom();
  const state = blackjackShowdown.init(room, "classic");
  assert.equal(state.round, 1);
  assert.equal(state.dealer.length, 2);
  assert.equal(room.scores.p1, 190);
  assert.equal(state.hands.p1.length, 2);
  const view = blackjackShowdown.viewFor(room, "p1");
  assert.equal(view.hand.length, 2);
  assert.equal(view.dealerHidden, 1);
  const publicView = JSON.stringify(blackjackShowdown.publicFor(room));
  assert.equal(publicView.includes(state.hands.p1[0].id), false);
  assert.equal(publicView.includes(state.hands.p2[0].id), false);
});

test("hitting to 21 and standing resolves the dealer and pays the winner", () => {
  const room = makeRoom();
  const state = blackjackShowdown.init(room, "classic");
  state.hands = {
    p1: [card("5", "p1-5", 5), card("6", "p1-6", 6)],
    p2: [card("5", "p2-5", 5), card("6", "p2-6", 6)],
  };
  state.dealer = [card("10", "d-10", 10), card("7", "d-7", 7)];
  state.acted = {};
  state.deck = [card("10", "hit-10", 10)];
  state.turnOrder = ["p1", "p2"];
  state.turnIndex = 0;
  blackjackShowdown.onEvent(room, "p1", { type: "hit" });
  assert.equal(state.hands.p1.length, 3);
  assert.equal(state.turnOrder[state.turnIndex], "p2");
  blackjackShowdown.onEvent(room, "p2", { type: "stand" });
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.results.p1.outcome, "win");
  assert.equal(state.reveal.results.p2.outcome, "lose");
  assert.equal(room.scores.p1, 210);
  assert.equal(room.scores.p2, 190);
});

test("a natural blackjack pays three to two", () => {
  const room = makeRoom();
  const state = blackjackShowdown.init(room, "classic");
  state.hands = {
    p1: [card("A", "p1-a", 1), card("K", "p1-k", 10)],
    p2: [card("10", "p2-10", 10), card("9", "p2-9", 9)],
  };
  state.dealer = [card("10", "d-10", 10), card("7", "d-7", 7)];
  state.acted = { p1: "stand" };
  state.turnOrder = ["p1", "p2"];
  state.turnIndex = 1;
  blackjackShowdown.onEvent(room, "p2", { type: "stand" });
  assert.equal(state.reveal.results.p1.outcome, "blackjack");
  assert.equal(room.scores.p1, 215);
});

test("a bust loses the ante and timeout auto-stands", () => {
  const room = makeRoom();
  const state = blackjackShowdown.init(room, "classic");
  state.hands = {
    p1: [card("K", "p1-k", 10), card("6", "p1-6", 6)],
    p2: [card("10", "p2-10", 10), card("9", "p2-9", 9)],
  };
  state.dealer = [card("10", "d-10", 10), card("7", "d-7", 7)];
  state.acted = {};
  state.deck = [card("10", "bust", 10)];
  state.turnOrder = ["p1", "p2"];
  state.turnIndex = 0;
  blackjackShowdown.onEvent(room, "p1", { type: "hit" });
  assert.equal(state.turnOrder[state.turnIndex], "p2");
  blackjackShowdown.onPhaseEnd(room);
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.results.p1.outcome, "bust");
  assert.equal(room.scores.p1, 190);
});

test("eight rounds finish the match and leaving ends a short table", () => {
  const room = makeRoom();
  const state = blackjackShowdown.init(room, "classic");
  state.round = 8;
  state.phase = "reveal";
  assert.equal(blackjackShowdown.onPhaseEnd(room), "results");
  assert.equal(state.done, true);

  const room2 = makeRoom();
  const state2 = blackjackShowdown.init(room2, "classic");
  room2.players.delete("p2");
  blackjackShowdown.onPlayerLeave(room2, "p2");
  assert.equal(state2.done, true);
});
