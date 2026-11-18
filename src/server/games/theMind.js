import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: { label: "Classic", description: "Five levels, three shared lives", levels: 5, lives: 3, levelMs: 240_000, revealMs: 9_000 },
  short: { label: "Short", description: "Three levels with two lives", levels: 3, lives: 2, levelMs: 150_000, revealMs: 7_000 },
};

function makeDeck() {
  return Array.from({ length: 100 }, (_, index) => index + 1);
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function dealLevel(room, state) {
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  const deck = shuffle(makeDeck());
  state.hands = Object.fromEntries(active.map((player) => [player.id, []]));
  let index = 0;
  for (let count = 0; count < state.level; count += 1) {
    for (const player of active) {
      state.hands[player.id].push(deck[index]);
      index += 1;
    }
  }
  for (const player of active) state.hands[player.id].sort((a, b) => a - b);
  state.phase = "play";
  state.highest = 0;
  state.played = [];
  state.endsAt = Date.now() + configFor(MODES, room.mode).levelMs;
}

function completeLevel(room, state) {
  for (const player of activePlayers(room)) {
    room.scores[player.id] = Number(room.scores[player.id] || 0) + 100;
  }
  if (state.level >= state.config.levels) {
    state.won = true;
    state.done = true;
    state.phase = "reveal";
    state.endsAt = null;
    return "results";
  }
  state.level += 1;
  if (state.level % 2 === 0) state.lives = Math.min(3, state.lives + 1);
  dealLevel(room, state);
  return undefined;
}

function loseLife(room, state, playerId) {
  state.lives -= 1;
  state.mistake = {
    playerId, name: room.players.get(playerId)?.name || "Player",
    value: state.lastPlayedValue,
  };
  if (state.lives <= 0) {
    state.done = true;
    state.won = false;
    state.phase = "reveal";
    state.endsAt = null;
    return "results";
  }
  dealLevel(room, state);
  return undefined;
}

const theMind = {
  id: "the-mind",
  name: "The Mind", description: "No talking. Play your cards in ascending order as one team.",
  emoji: "🧠", accent: "grape", tag: "Strategy",
  minPlayers: 2, maxPlayers: 8, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "play", level: 1, config: configFor(MODES, room.mode),
      lives: configFor(MODES, room.mode).lives, hands: {}, played: [],
      highest: 0, mistake: null, won: false, done: false, endsAt: null,
    };
    dealLevel(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "play" || event.type !== "play") return;
    const hand = state.hands[playerId];
    if (!hand) throw failure("not_playing", "You have no hand this level");
    const value = Number(event.value);
    if (!hand.includes(value)) throw failure("not_in_hand", "That card is not in your hand");
    state.hands[playerId] = hand.filter((card) => card !== value);
    state.lastPlayedValue = value;
    state.played.push({ playerId, name: room.players.get(playerId)?.name || "Player", value, correct: value > state.highest });
    if (value > state.highest) {
      state.highest = value;
      room.scores[playerId] = Number(room.scores[playerId] || 0) + 50;
    } else {
      return loseLife(room, state, playerId);
    }
    const remaining = activePlayers(room).some((player) => (state.hands[player.id] || []).length > 0);
    if (!remaining) return completeLevel(room, state);
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "play") {
      const playerId = activePlayers(room)[0]?.id || null;
      return loseLife(room, state, playerId);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.hands[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      state.phase = "reveal";
      return "results";
    }
    if (!activePlayers(room).some((player) => (state.hands[player.id] || []).length > 0)) {
      return completeLevel(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    return {
      phase: state.phase, mode: room.mode, level: state.level, levels: state.config.levels,
      lives: state.lives, myHand: state.hands[viewerId] || [],
      played: state.played, mistake: state.mistake, won: state.won,
      handsLeft: activePlayers(room).map((player) => ({
        playerId: player.id, name: player.name, count: (state.hands[player.id] || []).length,
      })),
      levelMs: state.config.levelMs,
    };
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase, level: state.level, levels: state.config.levels, lives: state.lives,
      played: state.played, mistake: state.mistake, won: state.won,
      handsLeft: activePlayers(room).map((player) => ({
        playerId: player.id, name: player.name, count: (state.hands[player.id] || []).length,
      })),
    };
  },
};

export default theMind;
