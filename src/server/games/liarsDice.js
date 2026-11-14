import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "Five dice each, ones are wild, raise or call the bluff",
    dice: 5,
    wildOnes: true,
    turnMs: 25_000,
    revealMs: 8_000,
  },
  fast: {
    label: "Fast",
    description: "Three dice, no wild ones, quicker decisions",
    dice: 3,
    wildOnes: false,
    turnMs: 18_000,
    revealMs: 6_000,
  },
};

function rollDice(count) {
  return Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
}

function beginRound(room, state) {
  const alive = activePlayers(room).filter(
    (player) => (state.dice[player.id] || []).length > 0,
  );
  if (alive.length <= 1) return finishGame(room, state);
  state.phase = "bid";
  state.round += 1;
  state.currentBid = null;
  state.loserId = null;
  state.reveal = null;
  state.turnOrder = alive
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((player) => player.id);
  state.turnIndex = state.startingIndex % state.turnOrder.length;
  state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
  return undefined;
}

function finishGame(room, state) {
  const alive = activePlayers(room).filter(
    (player) => (state.dice[player.id] || []).length > 0,
  );
  const order = [...alive.map((player) => player.id), ...[...state.eliminated].reverse()];
  const placement = [1000, 700, 500, 300, 200, 100, 50, 25];
  order.forEach((playerId, index) => {
    if (!room.players.has(playerId)) return;
    room.scores[playerId] =
      Number(room.scores[playerId] || 0) + (placement[index] || 0);
  });
  state.done = true;
  return "results";
}

function countFace(dice, face, wildOnes) {
  return dice.filter(
    (value) => value === face || (wildOnes && face !== 1 && value === 1),
  ).length;
}

function resolveChallenge(room, state, challengerId) {
  const config = configFor(MODES, room.mode);
  const bid = state.currentBid;
  const allDice = Object.values(state.dice).flat();
  const matches = countFace(allDice, bid.face, config.wildOnes);
  const bidMade = matches >= bid.quantity;
  const loserId = bidMade ? challengerId : bid.playerId;
  const dice = state.dice[loserId] || [];
  dice.pop();
  state.dice[loserId] = dice;
  if (!dice.length) state.eliminated.push(loserId);
  state.loserId = loserId;
  state.reveal = {
    bid,
    challengerId,
    challengerName: room.players.get(challengerId)?.name || "Player",
    bidderName: room.players.get(bid.playerId)?.name || "Player",
    matches,
    bidMade,
    loserId,
    loserName: room.players.get(loserId)?.name || "Player",
    dice: Object.entries(state.dice).map(([playerId, values]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      dice: [...values],
    })),
    eliminated: state.eliminated.map((playerId) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
    })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
  state.startingIndex = (state.startingIndex + 1) % Math.max(1, state.turnOrder.length);
}

function validRaise(current, quantity, face) {
  if (!current) return quantity >= 1 && face >= 1 && face <= 6;
  return quantity > current.quantity || (quantity === current.quantity && face > current.face);
}

function autoRaise(room, state) {
  const current = state.currentBid;
  const totalDice = Object.values(state.dice).reduce(
    (total, dice) => total + dice.length,
    0,
  );
  if (!current) return { quantity: 1, face: 1 };
  if (current.quantity < totalDice) {
    return { quantity: current.quantity + 1, face: current.face };
  }
  if (current.face < 6) return { quantity: current.quantity, face: current.face + 1 };
  return null;
}

const liarsDice = {
  id: "liars-dice",
  name: "Liar's Dice",
  description: "Hide your dice, raise the bid, and call the bluff.",
  emoji: "🎲",
  accent: "teal",
  tag: "Strategy",
  minPlayers: 3,
  maxPlayers: 8,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const state = {
      phase: "bid",
      round: 0,
      dice: {},
      turnOrder: [],
      turnIndex: 0,
      startingIndex: 0,
      currentBid: null,
      loserId: null,
      reveal: null,
      eliminated: [],
      done: false,
      endsAt: null,
    };
    for (const player of activePlayers(room)) {
      state.dice[player.id] = rollDice(config.dice);
    }
    room.state = state;
    beginRound(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "bid") return;
    const currentId = state.turnOrder[state.turnIndex];
    if (playerId !== currentId) throw failure("not_your_turn", "Wait for your turn");
    const bid = state.currentBid;
    if (event.type === "bid") {
      const quantity = Number(event.quantity);
      const face = Number(event.face);
      if (!Number.isInteger(quantity) || !Number.isInteger(face)) {
        throw failure("invalid_bid", "Choose a quantity and a face");
      }
      if (!validRaise(bid, quantity, face)) {
        throw failure("bid_too_low", "Raise the quantity or the face");
      }
      state.currentBid = { quantity, face, playerId };
      state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
      state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
      return;
    }
    if (event.type === "call") {
      if (!bid) throw failure("no_bid", "There is no bid to call yet");
      return resolveChallenge(room, state, playerId);
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "bid") {
      const currentId = state.turnOrder[state.turnIndex];
      const raise = autoRaise(room, state);
      if (!raise) {
        if (state.currentBid) return resolveChallenge(room, state, currentId);
        state.currentBid = { quantity: 1, face: 1, playerId: currentId };
        state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
        state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
        return;
      }
      state.currentBid = { ...raise, playerId: currentId };
      state.turnIndex = (state.turnIndex + 1) % state.turnOrder.length;
      state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
      return;
    }
    if (state.phase === "reveal") {
      const alive = activePlayers(room).filter(
        (player) => (state.dice[player.id] || []).length > 0,
      );
      if (alive.length <= 1) return finishGame(room, state);
      return beginRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.dice[playerId];
    state.turnOrder = state.turnOrder.filter((id) => id !== playerId);
    state.eliminated = state.eliminated.filter((id) => id !== playerId);
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (!state.turnOrder.length) {
      state.done = true;
      return "results";
    }
    state.turnIndex = state.turnIndex % state.turnOrder.length;
    if (state.currentBid?.playerId === playerId) {
      state.currentBid = null;
    }
    if (state.phase === "reveal" && state.loserId === playerId) {
      state.phase = "bid";
      state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const currentId = state.turnOrder[state.turnIndex] || null;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: null,
      myDice: [...(state.dice[viewerId] || [])],
      diceCounts: Object.fromEntries(
        Object.entries(state.dice).map(([playerId, dice]) => [playerId, dice.length]),
      ),
      currentBid: state.currentBid,
      currentPlayerId: currentId,
      currentPlayerName: currentId
        ? room.players.get(currentId)?.name || "Player"
        : null,
      canAct: currentId === viewerId && state.phase === "bid",
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const currentId = state.turnOrder[state.turnIndex] || null;
    return {
      phase: state.phase,
      round: state.round,
      diceCounts: Object.fromEntries(
        Object.entries(state.dice).map(([playerId, dice]) => [playerId, dice.length]),
      ),
      currentBid: state.currentBid,
      currentPlayerName: currentId
        ? room.players.get(currentId)?.name || "Player"
        : null,
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
  },
};

export default liarsDice;
