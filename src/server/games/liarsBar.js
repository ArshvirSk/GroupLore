import {
  addToPile,
  buildDeck,
  createPile,
  dealCards,
  discardCards,
  publicHands,
  refillHands,
  removeCards,
  revealCards,
  seededShuffle,
} from "./cards.js";
import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "Three strikes eliminate you; last player standing wins",
    strikes: 3,
    turnMs: 25_000,
    revealMs: 9_000,
  },
  quick: {
    label: "Quick",
    description: "One strike and you are out",
    strikes: 1,
    turnMs: 25_000,
    revealMs: 7_000,
  },
};

const TABLE_RANKS = ["K", "Q", "A"];
const HAND_SIZE = 5;
const JOKER = "JOKER";

function deckFor(playerCount) {
  // The 20-card table composition is preserved. Larger tables use additional
  // 20-card sets because 3-8 players at five cards each cannot share one set.
  const sets = Math.max(1, Math.ceil((playerCount * HAND_SIZE) / 20));
  return buildDeck([
    { id: "king", rank: "K", value: 13, count: 6 * sets },
    { id: "queen", rank: "Q", value: 12, count: 6 * sets },
    { id: "ace", rank: "A", value: 14, count: 6 * sets },
    { id: "joker", rank: JOKER, joker: true, value: 15, count: 2 * sets },
  ]);
}

function aliveIds(room, state) {
  const eliminated = new Set(state.eliminated);
  return activePlayers(room)
    .map((player) => player.id)
    .filter((playerId) => !eliminated.has(playerId))
    .sort(
      (a, b) =>
        Number(room.players.get(a)?.joinedAt || 0) -
        Number(room.players.get(b)?.joinedAt || 0),
    );
}

function currentPlayerId(room, state) {
  return state.turnOrder[state.turnIndex] || null;
}

function setTurnTimer(room, state) {
  state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
}

function finishGame(room, state) {
  const alive = aliveIds(room, state);
  const order = [...alive, ...[...state.eliminated].reverse()].filter((playerId) =>
    room.players.has(playerId),
  );
  const placement = [1000, 700, 500, 300, 200, 100, 50, 25];
  order.forEach((playerId, index) => {
    room.scores[playerId] =
      Number(room.scores[playerId] || 0) + (placement[index] || 0);
  });
  state.done = true;
  return "results";
}

function beginRound(room, state) {
  const active = aliveIds(room, state);
  if (active.length <= 1) return finishGame(room, state);

  state.round += 1;
  state.phase = "turn";
  state.turnOrder = active;
  state.turnIndex = (state.round - 1) % active.length;
  state.tableRank =
    TABLE_RANKS[(state.round - 1) % TABLE_RANKS.length];
  if (state.pile.length) {
    state.discard = discardCards(state.discard, state.pile);
  }
  state.pile = [];
  state.lastPlay = null;
  state.reveal = null;
  state.finishAfterReveal = false;

  const refilled = refillHands({
    hands: state.hands,
    deck: state.deck,
    playerIds: active,
    size: HAND_SIZE,
    discard: state.discard,
    seed: `liars-bar-${room.id}-${state.round}`,
  });
  state.hands = refilled.hands;
  state.deck = refilled.deck;
  state.discard = refilled.discard;
  if (state.deck.length) {
    state.deck = seededShuffle(state.deck, `liars-bar-deck-${state.round}`);
  }
  setTurnTimer(room, state);
  return undefined;
}

function advanceTurn(room, state) {
  if (!state.turnOrder.length) {
    state.done = true;
    return;
  }
  state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
  setTurnTimer(room, state);
}

function playCards(room, state, playerId, cardIds) {
  if (state.phase !== "turn") throw failure("wrong_phase", "Cards cannot be played now");
  if (currentPlayerId(room, state) !== playerId) {
    throw failure("not_your_turn", "Wait for your turn");
  }
  const hand = state.hands[playerId] || [];
  if (!hand.length) {
    throw failure("must_call", "You have no cards, so call liar");
  }
  const ids = Array.isArray(cardIds)
    ? [...new Set(cardIds.map(String))]
    : [];
  if (ids.length < 1 || ids.length > 3) {
    throw failure("invalid_play", "Play between one and three cards");
  }
  if (ids.some((cardId) => !hand.some((card) => card.id === cardId))) {
    throw failure("card_not_in_hand", "That card is not in your hand");
  }

  const removed = removeCards(hand, ids);
  state.hands[playerId] = removed.hand;
  state.pile = addToPile(state.pile, removed.removed, { faceDown: true });
  state.lastPlay = {
    playerId,
    name: room.players.get(playerId)?.name || "Player",
    cards: removed.removed,
    count: removed.removed.length,
  };
  advanceTurn(room, state);
}

function resolveCall(room, state, callerId) {
  if (state.phase !== "turn") throw failure("wrong_phase", "There is nothing to call");
  if (currentPlayerId(room, state) !== callerId) {
    throw failure("not_your_turn", "Wait for your turn");
  }
  if (!state.lastPlay) {
    throw failure("nothing_to_call", "Play cards before calling liar");
  }

  const claimed = state.tableRank;
  const cards = state.lastPlay.cards;
  const wasLie = cards.some(
    (card) => card.rank !== claimed && card.rank !== JOKER,
  );
  const loserId = wasLie ? state.lastPlay.playerId : callerId;
  const config = configFor(MODES, room.mode);
  state.strikes[loserId] = Number(state.strikes[loserId] || 0) + 1;
  const eliminatedNow = state.strikes[loserId] >= config.strikes;
  if (eliminatedNow && !state.eliminated.includes(loserId)) {
    state.eliminated.push(loserId);
    state.discard = discardCards(state.discard, state.hands[loserId] || []);
    delete state.hands[loserId];
  }

  state.reveal = {
    callerId,
    callerName: room.players.get(callerId)?.name || "Player",
    playerId: state.lastPlay.playerId,
    playerName: state.lastPlay.name,
    claimed,
    cards: revealCards(cards),
    wasLie,
    stamp: wasLie ? "Caught!" : "Honest!",
    loserId,
    loserName: room.players.get(loserId)?.name || "Player",
    strikes: Object.fromEntries(
      [...room.players.keys()].map((playerId) => [
        playerId,
        Number(state.strikes[playerId] || 0),
      ]),
    ),
    eliminated: state.eliminated.map((playerId) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
    })),
    maxStrikes: config.strikes,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
  state.finishAfterReveal = aliveIds(room, state).length <= 1;
  return undefined;
}

function autoPlay(room, state) {
  const playerId = currentPlayerId(room, state);
  if (!playerId) return finishGame(room, state);
  const hand = state.hands[playerId] || [];
  if (!hand.length) {
    if (state.lastPlay) return resolveCall(room, state, playerId);
    advanceTurn(room, state);
    return undefined;
  }
  const lowest = [...hand].sort(
    (a, b) => Number(a.value || 0) - Number(b.value || 0),
  )[0];
  playCards(room, state, playerId, [lowest.id]);
  return undefined;
}

function returnPlayerCards(state, playerId) {
  const hand = state.hands[playerId] || [];
  delete state.hands[playerId];
  if (hand.length) {
    state.deck = seededShuffle(
      [...state.deck, ...hand],
      `leave-${playerId}-${state.round}`,
    );
  }
}

const liarsBar = {
  id: "liars-bar",
  name: "Liars Bar",
  description: "Play cards face-down, claim the rank, and catch the liar.",
  emoji: "🍸",
  accent: "dark",
  tag: "Strategy",
  minPlayers: 2,
  maxPlayers: 8,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const active = activePlayers(room).map((player) => player.id);
    const deck = seededShuffle(deckFor(active.length), `${room.id}-deal`);
    const dealt = dealCards(deck, active, HAND_SIZE);
    const state = {
      phase: "turn",
      round: 0,
      tableRank: "K",
      deck: dealt.deck,
      discard: [],
      hands: dealt.hands,
      pile: createPile(),
      lastPlay: null,
      turnOrder: active,
      turnIndex: 0,
      strikes: Object.fromEntries(active.map((playerId) => [playerId, 0])),
      eliminated: [],
      reveal: null,
      finishAfterReveal: false,
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
    if (state.phase === "turn" && event.type === "play") {
      playCards(room, state, playerId, event.cardIds);
      return;
    }
    if (state.phase === "turn" && event.type === "call") {
      resolveCall(room, state, playerId);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "turn") {
      autoPlay(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.finishAfterReveal || aliveIds(room, state).length <= 1) {
        return finishGame(room, state);
      }
      beginRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    const wasLast = state.lastPlay?.playerId === playerId;
    returnPlayerCards(state, playerId);
    delete state.strikes[playerId];
    state.eliminated = state.eliminated.filter((id) => id !== playerId);
    state.turnOrder = state.turnOrder.filter((id) => id !== playerId);

    if (wasLast) {
      state.discard = discardCards(state.discard, state.pile);
      state.pile = [];
      state.lastPlay = null;
    }
    const alive = aliveIds(room, state);
    if (alive.length <= 1) return finishGame(room, state);
    if (!state.turnOrder.length) state.turnOrder = alive;
    state.turnIndex = Math.min(state.turnIndex, state.turnOrder.length - 1);
    if (currentPlayerId(room, state) === playerId || !currentPlayerId(room, state)) {
      state.turnIndex = 0;
    }
    if (state.phase === "turn") setTurnTimer(room, state);
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);
    const currentId = currentPlayerId(room, state);
    const alive = aliveIds(room, state);
    const base = {
      phase: state.phase,
      round: state.round,
      mode: room.mode,
      tableRank: state.tableRank,
      currentPlayerId: currentId,
      currentPlayerName: room.players.get(currentId)?.name || "Player",
      isYourTurn: currentId === viewerId,
      hand: state.hands[viewerId] || [],
      handCounts: publicHands(state.hands, [...room.players.keys()]),
      strikes: Object.fromEntries(
        [...room.players.keys()].map((playerId) => [
          playerId,
          Number(state.strikes[playerId] || 0),
        ]),
      ),
      maxStrikes: config.strikes,
      eliminated: state.eliminated,
      pileCount: state.pile.length,
      lastPlay: state.lastPlay
        ? {
            playerId: state.lastPlay.playerId,
            name: state.lastPlay.name,
            count: state.lastPlay.count,
          }
        : null,
      mustCall: (state.hands[viewerId] || []).length === 0,
      canCall: currentId === viewerId && Boolean(state.lastPlay),
      aliveCount: alive.length,
      turnMs: config.turnMs,
    };
    if (state.phase === "reveal") return { ...base, reveal: state.reveal };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const config = configFor(MODES, room.mode);
    const currentId = currentPlayerId(room, state);
    const base = {
      phase: state.phase,
      round: state.round,
      tableRank: state.tableRank,
      currentPlayerId: currentId,
      currentPlayerName: room.players.get(currentId)?.name || "Player",
      handCounts: publicHands(state.hands, [...room.players.keys()]),
      strikes: Object.fromEntries(
        [...room.players.keys()].map((playerId) => [
          playerId,
          Number(state.strikes[playerId] || 0),
        ]),
      ),
      maxStrikes: config.strikes,
      eliminated: state.eliminated,
      pileCount: state.pile.length,
      lastPlay: state.lastPlay
        ? {
            playerId: state.lastPlay.playerId,
            name: state.lastPlay.name,
            count: state.lastPlay.count,
          }
        : null,
    };
    if (state.phase === "reveal") return { ...base, reveal: state.reveal };
    return base;
  },
};

export default liarsBar;
