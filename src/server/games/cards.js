/**
 * Pure card primitives shared by card games.
 *
 * Cards are plain objects. The only reserved field is `id`; games may add a
 * rank, suit, label or joker flag. Hidden information is never encoded in the
 * public helpers: they return counts and anonymous backs, not card faces.
 */

const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = [
  { rank: "A", value: 14 },
  { rank: "K", value: 13 },
  { rank: "Q", value: 12 },
  { rank: "J", value: 11 },
  { rank: "10", value: 10 },
  { rank: "9", value: 9 },
  { rank: "8", value: 8 },
  { rank: "7", value: 7 },
  { rank: "6", value: 6 },
  { rank: "5", value: 5 },
  { rank: "4", value: 4 },
  { rank: "3", value: 3 },
  { rank: "2", value: 2 },
];

function seedNumber(seed) {
  let hash = 2166136261;
  const text = String(seed ?? "cards");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle. The input array is never mutated. */
export function seededShuffle(items, seed = "cards") {
  const shuffled = [...items];
  const random = randomFromSeed(seedNumber(seed));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

/**
 * Expand a compact deck definition into physical cards.
 * Each entry may include `count` for duplicate copies and `id` for a stable
 * prefix. Generated ids are unique within the returned deck.
 */
export function buildDeck(definition) {
  const cards = [];
  for (const [entryIndex, entry] of (definition || []).entries()) {
    const count = Math.max(0, Number(entry.count ?? 1));
    const prefix = entry.id || entry.rank || `card-${entryIndex}`;
    for (let copy = 0; copy < count; copy += 1) {
      const card = { ...entry };
      delete card.count;
      cards.push({
        ...card,
        id: `${prefix}-${entryIndex}-${copy}`,
      });
    }
  }
  return cards;
}

export function standardDeck() {
  return buildDeck(
    SUITS.flatMap((suit) =>
      RANKS.map(({ rank, value }) => ({
        id: `${rank.toLowerCase()}-${suit}`,
        suit,
        rank,
        value,
        color: suit === "hearts" || suit === "diamonds" ? "red" : "black",
      })),
    ),
  );
}

/** Draw from the front of the deck without mutating it. */
export function drawCards(deck, count = 1) {
  const take = Math.max(0, Math.min(Number(count) || 0, deck.length));
  return {
    cards: deck.slice(0, take),
    deck: deck.slice(take),
  };
}

export function dealCards(deck, playerIds, count) {
  let rest = [...deck];
  const hands = {};
  for (const playerId of playerIds) {
    const drawn = drawCards(rest, count);
    hands[playerId] = drawn.cards;
    rest = drawn.deck;
  }
  return { hands, deck: rest };
}

/**
 * Fill every hand to `size`, reshuffling the discard pile only when the draw
 * deck runs out. The return value is a fresh object; no input array is mutated.
 */
export function refillHands({
  hands = {},
  deck = [],
  playerIds = [],
  size = 5,
  discard = [],
  seed = "refill",
}) {
  let drawPile = [...deck];
  let recycle = [...discard];
  const nextHands = {};

  for (const [index, playerId] of playerIds.entries()) {
    const hand = [...(hands[playerId] || [])];
    while (hand.length < size) {
      if (!drawPile.length) {
        if (!recycle.length) break;
        drawPile = seededShuffle(recycle, `${seed}:${index}`);
        recycle = [];
      }
      hand.push(drawPile.shift());
    }
    nextHands[playerId] = hand;
  }

  return { hands: nextHands, deck: drawPile, discard: recycle };
}

export function removeCards(hand, cardIds) {
  const ids = new Set((cardIds || []).map(String));
  const removed = [];
  const next = [];
  for (const card of hand || []) {
    if (ids.has(String(card.id))) removed.push(card);
    else next.push(card);
  }
  return { hand: next, removed };
}

export function discardCards(discard, cards) {
  return [...(discard || []), ...(cards || []).map((card) => ({ ...card, faceUp: false }))];
}

/**
 * A table pile is ordered oldest to newest. Cards are face-down by default;
 * reveal helpers flip only the cards a phase is allowed to show.
 */
export function createPile(cards = [], { faceDown = true } = {}) {
  return (cards || []).map((card) => ({
    ...card,
    faceUp: faceDown ? false : Boolean(card.faceUp),
  }));
}

export function addToPile(pile, cards, { faceDown = true } = {}) {
  return [
    ...(pile || []),
    ...(cards || []).map((card) => ({
      ...card,
      faceUp: faceDown ? false : Boolean(card.faceUp),
    })),
  ];
}

export function revealCards(cards) {
  return (cards || []).map((card) => ({ ...card, faceUp: true }));
}

export function takePile(pile) {
  return {
    cards: (pile || []).map((card) => ({ ...card, faceUp: false })),
    pile: [],
  };
}

/** Public hand information contains only sizes and anonymous card backs. */
export function publicHands(hands, playerIds = Object.keys(hands || {})) {
  return Object.fromEntries(
    playerIds.map((playerId) => {
      const count = (hands?.[playerId] || []).length;
      return [
        playerId,
        {
          count,
          backIds: Array.from({ length: count }, (_, index) => `back-${index}`),
        },
      ];
    }),
  );
}

export function faceDownCard(card) {
  return { id: `back-${card?.id ?? "card"}`, faceUp: false };
}

export { SUITS, RANKS };
