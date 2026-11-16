import {
  addToPile,
  buildDeck,
  createPile,
  drawCards,
  publicHands,
  removeCards,
  revealCards,
  seededShuffle,
  standardDeck,
  takePile,
} from "./cards.js";
import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "Full 52-card deck; first empty hand wins",
    turnMs: 22_000,
    revealMs: 7_000,
    deck: "full",
  },
  quick: {
    label: "Quick",
    description: "A 30-card deck for a faster climb",
    turnMs: 18_000,
    revealMs: 5_000,
    deck: "quick",
  },
};

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const MAX_PLAY = 4;

function quickDeck() {
  return buildDeck([
    { id: "a", rank: "A", value: 1, count: 3 },
    { id: "2", rank: "2", value: 2, count: 3 },
    { id: "3", rank: "3", value: 3, count: 3 },
    { id: "4", rank: "4", value: 4, count: 3 },
    { id: "5", rank: "5", value: 5, count: 3 },
    { id: "6", rank: "6", value: 6, count: 3 },
    { id: "7", rank: "7", value: 7, count: 3 },
    { id: "8", rank: "8", value: 8, count: 3 },
    { id: "9", rank: "9", value: 9, count: 3 },
    { id: "10", rank: "10", value: 10, count: 3 },
  ]);
}

function dealAll(deck, playerIds) {
  const hands = Object.fromEntries(playerIds.map((id) => [id, []]));
  let remaining = deck;
  let index = 0;
  while (remaining.length) {
    const playerId = playerIds[index % playerIds.length];
    const drawn = drawCards(remaining, 1);
    hands[playerId].push(drawn.cards[0]);
    remaining = drawn.deck;
    index += 1;
  }
  return hands;
}

function sortHand(hand) {
  return [...hand].sort(
    (a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank),
  );
}

function finishGame(room, state, winnerId) {
  const others = [...room.players.keys()]
    .filter((playerId) => playerId !== winnerId)
    .sort(
      (a, b) =>
        (state.hands[a]?.length ?? 99) - (state.hands[b]?.length ?? 99),
    );
  const order = [winnerId, ...others].filter((playerId) =>
    room.players.has(playerId),
  );
  const points = [1000, 700, 500, 300, 200, 100, 50, 25];
  order.forEach((playerId, index) => {
    room.scores[playerId] =
      Number(room.scores[playerId] || 0) + (points[index] || 0);
  });
  state.winnerId = winnerId;
  state.done = true;
  return "results";
}

function currentId(state) {
  return state.turnOrder[state.turnIndex] || null;
}

function advance(room, state) {
  state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
  state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
}

function play(room, state, playerId, cardIds) {
  if (state.phase !== "turn") throw failure("wrong_phase", "You cannot play now");
  if (currentId(state) !== playerId) {
    throw failure("not_your_turn", "Wait for your turn");
  }
  const hand = state.hands[playerId] || [];
  if (!hand.length) return finishGame(room, state, playerId);
  const ids = Array.isArray(cardIds)
    ? [...new Set(cardIds.map(String))]
    : [];
  if (ids.length < 1 || ids.length > MAX_PLAY) {
    throw failure("invalid_play", `Play one to ${MAX_PLAY} cards`);
  }
  if (ids.some((id) => !hand.some((card) => card.id === id))) {
    throw failure("card_not_in_hand", "That card is not in your hand");
  }
  const removed = removeCards(hand, ids);
  state.hands[playerId] = removed.hand;
  state.pile = addToPile(state.pile, removed.removed, { faceDown: true });
  state.lastPlay = {
    playerId,
    playerName: room.players.get(playerId)?.name || "Player",
    cards: removed.removed,
    count: removed.removed.length,
    claimedRank: state.claimedRank,
  };
  if (!state.hands[playerId].length) {
    state.phase = "reveal";
    state.reveal = {
      playerId,
      playerName: room.players.get(playerId)?.name || "Player",
      cards: [],
      wasLie: false,
      claimedRank: state.claimedRank,
      stamp: "Empty hand!",
      autoWin: true,
    };
    state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
    state.winnerId = playerId;
    return finishGame(room, state, playerId);
  }
  state.rankIndex = (state.rankIndex + 1) % RANKS.length;
  state.claimedRank = RANKS[state.rankIndex];
  advance(room, state);
  return undefined;
}

function callCheat(room, state, callerId) {
  if (state.phase !== "turn") throw failure("wrong_phase", "There is nothing to call");
  if (currentId(state) !== callerId) {
    throw failure("not_your_turn", "Wait for your turn");
  }
  if (!state.lastPlay) {
    throw failure("nothing_to_call", "Someone must play before you call");
  }
  const cards = state.lastPlay.cards;
  const claimed = state.lastPlay.claimedRank;
  const wasLie = cards.some((card) => card.rank !== claimed);
  const pickerId = wasLie ? state.lastPlay.playerId : callerId;
  const starterId = wasLie ? callerId : state.lastPlay.playerId;
  state.reveal = {
    callerId,
    callerName: room.players.get(callerId)?.name || "Player",
    playerId: state.lastPlay.playerId,
    playerName: state.lastPlay.playerName,
    claimedRank: claimed,
    cards: revealCards(cards),
    wasLie,
    stamp: wasLie ? "Caught!" : "Honest!",
    pickerId,
    pickerName: room.players.get(pickerId)?.name || "Player",
    starterId,
    starterName: room.players.get(starterId)?.name || "Player",
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
  return undefined;
}

function resolveReveal(room, state) {
  const reveal = state.reveal;
  if (reveal.autoWin) return "results";
  const picked = takePile(state.pile);
  state.hands[reveal.pickerId] = sortHand([
    ...(state.hands[reveal.pickerId] || []),
    ...picked.cards,
  ]);
  state.pile = [];
  state.lastPlay = null;
  state.reveal = null;
  state.rankIndex = 0;
  state.claimedRank = RANKS[0];
  state.phase = "turn";
  state.turnOrder = [...room.players.keys()].filter((id) =>
    room.players.get(id)?.connected,
  );
  state.turnIndex = Math.max(0, state.turnOrder.indexOf(reveal.starterId));
  state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
}

const cheat = {
  id: "cheat",
  name: "Cheat",
  description: "Play cards face-down in rank order and risk being caught.",
  emoji: "🃏",
  accent: "plum",
  tag: "Strategy",
  minPlayers: 3,
  maxPlayers: 8,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const active = activePlayers(room)
      .map((player) => player.id)
      .sort(
        (a, b) =>
          Number(room.players.get(a)?.joinedAt || 0) -
          Number(room.players.get(b)?.joinedAt || 0),
      );
    const baseDeck =
      configFor(MODES, room.mode).deck === "quick" ? quickDeck() : standardDeck();
    const deck = seededShuffle(baseDeck, `${room.id}-cheat`);
    const state = {
      phase: "turn",
      deck: [],
      hands: dealAll(deck, active),
      pile: createPile(),
      lastPlay: null,
      rankIndex: 0,
      claimedRank: RANKS[0],
      turnOrder: active,
      turnIndex: 0,
      reveal: null,
      winnerId: null,
      done: false,
      endsAt: Date.now() + configFor(MODES, room.mode).turnMs,
    };
    room.state = state;
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "turn" && event.type === "play") {
      return play(room, state, playerId, event.cardIds);
    }
    if (state.phase === "turn" && event.type === "call") {
      return callCheat(room, state, playerId);
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "turn") {
      const playerId = currentId(state);
      const hand = state.hands[playerId] || [];
      if (!hand.length) return finishGame(room, state, playerId);
      const lowest = [...hand].sort(
        (a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank),
      )[0];
      return play(room, state, playerId, [lowest.id]);
    }
    resolveReveal(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.hands[playerId];
    state.turnOrder = state.turnOrder.filter((id) => id !== playerId);
    const connected = activePlayers(room).map((player) => player.id);
    if (connected.length <= 1) {
      return finishGame(room, state, connected[0]);
    }
    if (!state.turnOrder.length) state.turnOrder = connected;
    state.turnIndex = Math.min(state.turnIndex, state.turnOrder.length - 1);
    if (!currentId(state)) state.turnIndex = 0;
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);
    const current = currentId(state);
    return {
      phase: state.phase,
      mode: room.mode,
      currentPlayerId: current,
      currentPlayerName: room.players.get(current)?.name || "Player",
      isYourTurn: current === viewerId,
      hand: state.hands[viewerId] || [],
      handCounts: publicHands(state.hands, [...room.players.keys()]),
      claimedRank: state.claimedRank,
      pileCount: state.pile.length,
      lastPlay: state.lastPlay
        ? {
            playerId: state.lastPlay.playerId,
            playerName: state.lastPlay.playerName,
            count: state.lastPlay.count,
            claimedRank: state.lastPlay.claimedRank,
          }
        : null,
      canCall: current === viewerId && Boolean(state.lastPlay),
      maxPlay: MAX_PLAY,
      turnMs: config.turnMs,
      reveal: state.phase === "reveal" ? state.reveal : null,
      winnerId: state.winnerId,
    };
  },

  publicFor(room) {
    const state = room.state;
    const current = currentId(state);
    return {
      phase: state.phase,
      currentPlayerId: current,
      currentPlayerName: room.players.get(current)?.name || "Player",
      handCounts: publicHands(state.hands, [...room.players.keys()]),
      claimedRank: state.claimedRank,
      pileCount: state.pile.length,
      lastPlay: state.lastPlay
        ? {
            playerId: state.lastPlay.playerId,
            playerName: state.lastPlay.playerName,
            count: state.lastPlay.count,
            claimedRank: state.lastPlay.claimedRank,
          }
        : null,
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
  },
};

export default cheat;
