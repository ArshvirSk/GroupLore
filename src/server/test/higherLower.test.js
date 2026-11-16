import assert from "node:assert/strict";
import { test } from "node:test";
import higherLower from "../games/higherLower.js";

function makeRoom() {
  const players = new Map();
  for (let index = 1; index <= 3; index += 1) {
    players.set(`p${index}`, {
      id: `p${index}`,
      name: `Player ${index}`,
      connected: true,
      joinedAt: index,
    });
  }
  return {
    id: "deck-room",
    mode: "deck",
    players,
    scores: { p1: 0, p2: 0, p3: 0 },
    state: null,
    endsAt: null,
  };
}

test("deck mode reveals one card at a time and hides the next card", () => {
  const room = makeRoom();
  const state = higherLower.init(room, "deck");
  assert.equal(state.round, 1);
  assert.equal(state.deck.length, 51);
  assert.ok(state.currentCard);
  const view = higherLower.viewFor(room, "p1");
  assert.equal(view.currentCard.id, state.currentCard.id);
  assert.equal(JSON.stringify(view).includes("nextCard"), false);
  assert.equal(JSON.stringify(higherLower.publicFor(room)).includes("nextCard"), false);
});

test("all guesses resolve, score streaks and start the next round", () => {
  const room = makeRoom();
  const state = higherLower.init(room, "deck");
  state.deck = [{ id: "forced", rank: "A", suit: "S", value: 14 }];
  state.currentCard = { id: "low", rank: "2", suit: "S", value: 2 };
  for (const id of ["p1", "p2", "p3"]) {
    higherLower.onEvent(room, id, { type: "guess", value: "higher" });
  }
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.correctAnswer, "higher");
  assert.equal(room.scores.p1, 1);
  assert.equal(state.reveal.nextCard.id, "forced");
  higherLower.onPhaseEnd(room);
  assert.equal(state.phase, "guess");
  assert.equal(state.round, 2);
  assert.equal(state.currentCard.id, "forced");
  assert.equal(state.nextCard, null);
});

test("a tie is a push and preserves the streak", () => {
  const room = makeRoom();
  const state = higherLower.init(room, "deck");
  state.currentCard = { id: "king", rank: "K", suit: "S", value: 13 };
  state.deck = [{ id: "king2", rank: "K", suit: "H", value: 13 }];
  state.streak.p1 = 3;
  higherLower.onEvent(room, "p1", { type: "guess", value: "higher" });
  higherLower.onEvent(room, "p2", { type: "guess", value: "higher" });
  higherLower.onEvent(room, "p3", { type: "guess", value: "higher" });
  assert.equal(state.reveal.correctAnswer, "tie");
  assert.equal(state.streak.p1, 3);
  assert.equal(room.scores.p1, 0);
});

test("an exhausted deck reshuffles and eight rounds finish the game", () => {
  const room = makeRoom();
  const state = higherLower.init(room, "deck");
  state.deck = [];
  higherLower.onEvent(room, "p1", { type: "guess", value: "higher" });
  higherLower.onEvent(room, "p2", { type: "guess", value: "lower" });
  higherLower.onEvent(room, "p3", { type: "guess", value: "higher" });
  assert.equal(state.phase, "reveal");
  assert.ok(state.deck.length >= 50);

  state.round = state.rounds;
  higherLower.onPhaseEnd(room);
  assert.equal(state.done, true);
  assert.equal(higherLower.onPhaseEnd(room), "results");
});
