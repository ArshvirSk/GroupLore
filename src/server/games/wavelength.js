import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/wavelength.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "One clue giver, one secret point on the spectrum",
    rounds: 4,
    clueMs: 25_000,
    guessMs: 25_000,
    revealMs: 9_000,
  },
  quick: {
    label: "Quick",
    description: "Three faster spectrum rounds",
    rounds: 3,
    clueMs: 18_000,
    guessMs: 18_000,
    revealMs: 7_000,
  },
};

function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function configFor(mode) {
  return MODES[mode] || MODES.classic;
}

function activePlayers(room) {
  return [...room.players.values()].filter((player) => player.connected);
}

function choosePrompt(state) {
  if (state.usedPromptIds.length >= PROMPTS.length) state.usedPromptIds = [];
  let index = Math.floor(Math.random() * PROMPTS.length);
  let guard = 0;
  while (state.usedPromptIds.includes(PROMPTS[index].id) && guard < 500) {
    index = Math.floor(Math.random() * PROMPTS.length);
    guard += 1;
  }
  state.usedPromptIds.push(PROMPTS[index].id);
  return PROMPTS[index];
}

function beginRound(room, state) {
  const config = configFor(room.mode);
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  if (active.length < 3) {
    state.done = true;
    return;
  }

  state.round += 1;
  state.phase = "clue";
  state.clueGiverId = active[(state.round - 1) % active.length].id;
  state.spectrum = choosePrompt(state);
  state.target = 10 + Math.floor(Math.random() * 81);
  state.clue = null;
  state.guesses = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.clueMs;
}

function resolveGuesses(room, state) {
  const guesserIds = activePlayers(room)
    .map((player) => player.id)
    .filter((playerId) => playerId !== state.clueGiverId);
  const values = guesserIds
    .map((playerId) => Number(state.guesses[playerId]))
    .filter((value) => Number.isFinite(value));
  const average = values.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : null;
  const distance = average === null ? null : Math.abs(average - state.target);
  const points = new Map();
  const add = (playerId, amount) => {
    if (!room.players.has(playerId) || amount <= 0) return;
    points.set(playerId, (points.get(playerId) || 0) + amount);
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  };

  for (const playerId of guesserIds) {
    const value = Number(state.guesses[playerId]);
    if (!Number.isFinite(value)) continue;
    const diff = Math.abs(value - state.target);
    add(playerId, diff <= 10 ? 2 : diff <= 20 ? 1 : 0);
  }
  if (distance !== null) {
    add(state.clueGiverId, distance <= 10 ? 2 : distance <= 20 ? 1 : 0);
  }

  state.reveal = {
    spectrum: state.spectrum,
    target: state.target,
    clue: state.clue,
    clueGiverId: state.clueGiverId,
    clueGiverName: room.players.get(state.clueGiverId)?.name || "Player",
    average,
    distance,
    guesses: guesserIds
      .filter((playerId) => Number.isFinite(Number(state.guesses[playerId])))
      .map((playerId) => {
        const value = Number(state.guesses[playerId]);
        const diff = Math.abs(value - state.target);
        return {
          playerId,
          name: room.players.get(playerId)?.name || "Player",
          value,
          distance: diff,
          points: diff <= 10 ? 2 : diff <= 20 ? 1 : 0,
        };
      }),
    roundPoints: [...points.entries()].map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: amount,
    })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(room.mode).revealMs;
}

const wavelength = {
  id: "wavelength",
  name: "Wavelength",
  description: "Give a clue that lands the group on the secret point of the spectrum.",
  emoji: "🌊",
  accent: "teal",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "clue",
      round: 0,
      rounds: configFor(room.mode).rounds,
      clueGiverId: null,
      spectrum: null,
      target: null,
      clue: null,
      guesses: {},
      reveal: null,
      usedPromptIds: [],
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

    if (state.phase === "clue" && event.type === "clue") {
      if (playerId !== state.clueGiverId) {
        throw failure("not_clue_giver", "Only the clue giver can send the clue");
      }
      if (state.clue !== null) {
        throw failure("already_clued", "You already sent the clue");
      }
      const clue = String(event.value ?? "").trim().slice(0, 100);
      if (!clue) throw failure("clue_required", "Type a clue first");
      state.clue = clue;
      state.phase = "guess";
      state.endsAt = Date.now() + configFor(room.mode).guessMs;
      return;
    }

    if (state.phase === "guess" && event.type === "guess") {
      if (playerId === state.clueGiverId) {
        throw failure("clue_giver_cannot_guess", "You gave the clue; let the group guess");
      }
      if (state.guesses[playerId] !== undefined) {
        throw failure("already_guessed", "You already guessed");
      }
      const value = Number(event.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw failure("invalid_guess", "Choose a number from 0 to 100");
      }
      state.guesses[playerId] = Math.round(value);
      const guessers = activePlayers(room).filter(
        (player) => player.id !== state.clueGiverId,
      );
      if (guessers.every((player) => state.guesses[player.id] !== undefined)) {
        resolveGuesses(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "clue") {
      state.clue = "No clue — the group is guessing blind.";
      state.phase = "guess";
      state.endsAt = Date.now() + configFor(room.mode).guessMs;
      return;
    }
    if (state.phase === "guess") {
      resolveGuesses(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      beginRound(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.guesses[playerId];
    if (playerId === state.clueGiverId || activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "guess") {
      const guessers = activePlayers(room).filter(
        (player) => player.id !== state.clueGiverId,
      );
      if (guessers.every((player) => state.guesses[player.id] !== undefined)) {
        resolveGuesses(room, state);
      }
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isClueGiver = viewerId === state.clueGiverId;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      isClueGiver,
      clueGiverName: room.players.get(state.clueGiverId)?.name || "Player",
      spectrum: state.spectrum,
    };

    if (state.phase === "clue") {
      return isClueGiver
        ? { ...base, target: state.target, clueMs: configFor(room.mode).clueMs }
        : { ...base, target: null, clueMs: configFor(room.mode).clueMs };
    }
    if (state.phase === "guess") {
      return {
        ...base,
        clue: state.clue,
        submitted: Object.keys(state.guesses).length,
        total: activePlayers(room).length - 1,
        myGuess: state.guesses[viewerId] ?? null,
      };
    }
    return { ...base, clue: state.clue, reveal: state.reveal };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      clueGiverName: room.players.get(state.clueGiverId)?.name || "Player",
      spectrum: state.spectrum,
    };
    if (state.phase === "clue") return base;
    if (state.phase === "guess") {
      return {
        ...base,
        clue: state.clue,
        submitted: Object.keys(state.guesses).length,
        total: activePlayers(room).length - 1,
      };
    }
    return { ...base, clue: state.clue, reveal: state.reveal };
  },
};

export default wavelength;
