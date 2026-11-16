import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addToPile,
  buildDeck,
  createPile,
  dealCards,
  drawCards,
  publicHands,
  refillHands,
  removeCards,
  revealCards,
  seededShuffle,
  standardDeck,
} from "../games/cards.js";

const cards = [
  { id: "a", rank: "A", suit: "spades" },
  { id: "b", rank: "K", suit: "hearts" },
  { id: "c", rank: "Q", suit: "clubs" },
  { id: "d", rank: "J", suit: "diamonds" },
];

test("seeded shuffle is deterministic and does not mutate its input", () => {
  const original = [...cards];
  const first = seededShuffle(cards, "table-1");
  assert.deepEqual(seededShuffle(cards, "table-1"), first);
  assert.notDeepEqual(seededShuffle(cards, "table-2"), first);
  assert.deepEqual(cards, original);
});

test("deck construction creates stable counts and unique ids", () => {
  const deck = buildDeck([
    { id: "king", rank: "K", count: 6 },
    { id: "joker", rank: "JOKER", count: 2 },
  ]);
  assert.equal(deck.length, 8);
  assert.equal(deck.filter((card) => card.rank === "K").length, 6);
  assert.equal(new Set(deck.map((card) => card.id)).size, 8);
  assert.equal(standardDeck().length, 52);
});

test("draw, deal, refill and removal are pure", () => {
  const deck = [...cards, ...cards.map((card) => ({ ...card, id: `${card.id}2` }))];
  const drawn = drawCards(deck, 3);
  assert.equal(drawn.cards.length, 3);
  assert.equal(drawn.deck.length, 5);
  assert.equal(deck.length, 8);

  const dealt = dealCards(deck, ["p1", "p2"], 2);
  assert.equal(dealt.hands.p1.length, 2);
  assert.equal(dealt.hands.p2.length, 2);
  assert.equal(dealt.deck.length, 4);

  const refilled = refillHands({
    hands: { p1: dealt.hands.p1 },
    deck: dealt.deck,
    playerIds: ["p1", "p2"],
    size: 3,
    discard: [cards[0], cards[1]],
    seed: "refill-test",
  });
  assert.equal(refilled.hands.p1.length, 3);
  assert.equal(refilled.hands.p2.length, 3);

  const removed = removeCards(refilled.hands.p1, [refilled.hands.p1[0].id]);
  assert.equal(removed.hand.length, 2);
  assert.equal(removed.removed.length, 1);
});

test("a pile stays face-down until revealed and public hands leak no faces", () => {
  const pile = addToPile(createPile(), cards.slice(0, 2));
  assert.equal(pile.every((card) => card.faceUp === false), true);
  assert.equal(revealCards(pile).every((card) => card.faceUp === true), true);

  const publicView = publicHands({ p1: cards.slice(0, 2), p2: cards.slice(2) });
  assert.deepEqual(publicView.p1, {
    count: 2,
    backIds: ["back-0", "back-1"],
  });
  const serialized = JSON.stringify(publicView);
  assert.equal(serialized.includes("spades"), false);
  assert.equal(serialized.includes("rank"), false);
});
