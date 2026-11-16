import {
  buildDeck,
  drawCards,
  seededShuffle,
} from "./cards.js";
import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "Eight rounds against the dealer with a 200-chip stack",
    rounds: 8,
    bet: 10,
    turnMs: 24_000,
    revealMs: 8_000,
  },
  quick: {
    label: "Quick",
    description: "Same eight rounds, faster decisions",
    rounds: 8,
    bet: 10,
    turnMs: 16_000,
    revealMs: 6_000,
  },
};

const RANKS = [
  ["A", 1],
  ["2", 2],
  ["3", 3],
  ["4", 4],
  ["5", 5],
  ["6", 6],
  ["7", 7],
  ["8", 8],
  ["9", 9],
  ["10", 10],
  ["J", 10],
  ["Q", 10],
  ["K", 10],
];

function shoe(decks = 3) {
  const suits = ["S", "H", "D", "C"];
  return buildDeck(
    suits.flatMap((suit) =>
      RANKS.map(([rank, value]) => ({
        id: `${suit}-${rank}`,
        rank,
        suit,
        value,
        count: decks,
      })),
    ),
  );
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else {
      total += Number(card.value || 0);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return {
    total,
    soft: aces > 0,
    blackjack: cards.length === 2 && total === 21,
  };
}

function activeIds(room) {
  return activePlayers(room)
    .map((player) => player.id)
    .sort(
      (a, b) =>
        Number(room.players.get(a)?.joinedAt || 0) -
        Number(room.players.get(b)?.joinedAt || 0),
    );
}

function draw(room, state, count = 1) {
  if (state.deck.length < count) {
    state.deck = seededShuffle(
      shoe(),
      `blackjack-${room.id}-${state.round}-${Date.now()}`,
    );
  }
  const drawn = drawCards(state.deck, count);
  state.deck = drawn.deck;
  return drawn.cards;
}

function finishGame(state) {
  state.done = true;
  return "results";
}

function nextTurn(room, state) {
  const active = activeIds(room);
  for (let offset = 0; offset < active.length; offset += 1) {
    const index = (state.turnIndex + offset) % active.length;
    const playerId = active[index];
    if (!state.acted[playerId]) {
      state.turnIndex = index;
      state.turnOrder = active;
      state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
      return;
    }
  }
  resolveDealer(room, state);
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  state.round += 1;
  if (state.round > config.rounds) return finishGame(state);
  const active = activeIds(room);
  state.phase = "turn";
  state.hands = {};
  state.acted = {};
  state.dealer = [];
  state.reveal = null;
  state.turnOrder = active;
  state.turnIndex = 0;
  state.bet = config.bet;

  for (const playerId of active) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) - config.bet;
    state.hands[playerId] = draw(room, state, 2);
    if (handValue(state.hands[playerId]).total === 21) {
      state.acted[playerId] = "stand";
    }
  }
  state.dealer = draw(room, state, 2);
  if (active.every((playerId) => state.acted[playerId])) {
    resolveDealer(room, state);
    return;
  }
  nextTurn(room, state);
}

function resolveDealer(room, state) {
  const dealer = [...state.dealer];
  while (handValue(dealer).total < 17) {
    dealer.push(...draw(room, state, 1));
  }
  state.dealer = dealer;
  const dealerValue = handValue(dealer);
  const hands = {};
  const totals = {};
  const results = {};
  for (const playerId of activeIds(room)) {
    const cards = state.hands[playerId] || [];
    const value = handValue(cards);
    hands[playerId] = cards;
    totals[playerId] = value.total;
    let outcome = "lose";
    let delta = -state.bet;
    if (value.total > 21) {
      outcome = "bust";
    } else if (value.blackjack && !dealerValue.blackjack) {
      outcome = "blackjack";
      delta = Math.round(state.bet * 1.5);
      room.scores[playerId] += state.bet + delta;
    } else if (dealerValue.total > 21 || value.total > dealerValue.total) {
      outcome = "win";
      delta = state.bet;
      room.scores[playerId] += state.bet + delta;
    } else if (value.total === dealerValue.total) {
      outcome = "push";
      delta = 0;
      room.scores[playerId] += state.bet;
    }
    results[playerId] = { outcome, delta };
  }
  state.reveal = {
    dealer: dealerValue,
    dealerCards: dealer,
    hands,
    totals,
    results,
    chips: Object.fromEntries(
      activeIds(room).map((playerId) => [
        playerId,
        Number(room.scores[playerId] || 0),
      ]),
    ),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const blackjackShowdown = {
  id: "blackjack-showdown",
  name: "Blackjack Showdown",
  description: "Hit, stand, and outlast the dealer across eight chip rounds.",
  emoji: "♠️",
  accent: "dark",
  tag: "Strategy",
  minPlayers: 2,
  maxPlayers: 8,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const ids = activeIds(room);
    for (const playerId of ids) room.scores[playerId] = 200;
    const state = {
      phase: "turn",
      round: 0,
      deck: seededShuffle(shoe(), `${room.id}-blackjack`),
      hands: {},
      dealer: [],
      acted: {},
      results: {},
      bet: 10,
      turnOrder: ids,
      turnIndex: 0,
      reveal: null,
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginRound(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "turn") return undefined;
    const current = state.turnOrder[state.turnIndex];
    if (current !== playerId) {
      throw failure("not_your_turn", "Wait for your turn");
    }
    if (event.type === "hit") {
      const value = handValue(state.hands[playerId] || []);
      if (value.total >= 21) {
        throw failure("no_hit", "You cannot hit this hand");
      }
      state.hands[playerId] = [
        ...(state.hands[playerId] || []),
        ...draw(room, state, 1),
      ];
      if (handValue(state.hands[playerId]).total >= 21) {
        state.acted[playerId] = "stand";
      }
      nextTurn(room, state);
      return undefined;
    }
    if (event.type === "stand") {
      state.acted[playerId] = "stand";
      nextTurn(room, state);
      return undefined;
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "turn") {
      const current = state.turnOrder[state.turnIndex];
      if (current) state.acted[current] = "stand";
      nextTurn(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= configFor(MODES, room.mode).rounds) {
        return finishGame(state);
      }
      beginRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.hands[playerId];
    delete state.acted[playerId];
    state.turnOrder = state.turnOrder.filter((id) => id !== playerId);
    if (activeIds(room).length < 2) return finishGame(state);
    if (state.phase === "turn") {
      const active = activeIds(room);
      state.turnOrder = active;
      state.turnIndex = Math.min(state.turnIndex, active.length - 1);
      nextTurn(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const you = state.hands[viewerId] || [];
    const yourValue = handValue(you);
    const dealerUp = state.dealer[0] || null;
    const config = configFor(MODES, room.mode);
    return {
      phase: state.phase,
      round: state.round,
      rounds: config.rounds,
      mode: room.mode,
      bet: state.bet,
      chips: Number(room.scores[viewerId] || 0),
      hand: you,
      handValue: yourValue.total,
      soft: yourValue.soft,
      dealerUp,
      dealerHidden: Math.max(0, state.dealer.length - 1),
      dealerTotal: state.phase === "reveal" ? state.reveal?.dealer.total : null,
      currentPlayerId: state.turnOrder[state.turnIndex] || null,
      currentPlayerName:
        room.players.get(state.turnOrder[state.turnIndex])?.name || "Player",
      isYourTurn:
        state.phase === "turn" &&
        state.turnOrder[state.turnIndex] === viewerId,
      canHit:
        state.phase === "turn" &&
        state.turnOrder[state.turnIndex] === viewerId &&
        yourValue.total < 21,
      acted: state.acted,
      handCounts: Object.fromEntries(
        activeIds(room).map((id) => [
          id,
          (state.hands[id] || []).length,
        ]),
      ),
      reveal: state.phase === "reveal" ? state.reveal : null,
      turnMs: config.turnMs,
    };
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase,
      round: state.round,
      dealerUp: state.dealer[0] || null,
      dealerHidden: Math.max(0, state.dealer.length - 1),
      handCounts: Object.fromEntries(
        activeIds(room).map((id) => [
          id,
          (state.hands[id] || []).length,
        ]),
      ),
      acted: state.acted,
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
  },
};

export default blackjackShowdown;
