import { createRequire } from "node:module";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const CATEGORIES = require("../data/prompts/higherLower.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Rate the room, then call six higher-or-lower rounds",
    pollMs: 30_000,
    guessMs: 15_000,
    revealMs: 7_000,
    rounds: 6,
  },
  quick: {
    label: "Quick",
    description: "A faster poll and four calls",
    pollMs: 20_000,
    guessMs: 10_000,
    revealMs: 5_000,
    rounds: 4,
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

function chooseCategory(state) {
  if (state.usedCategoryIds.length >= CATEGORIES.length) state.usedCategoryIds = [];
  let index = Math.floor(Math.random() * CATEGORIES.length);
  let guard = 0;
  while (state.usedCategoryIds.includes(CATEGORIES[index].id) && guard < 500) {
    index = Math.floor(Math.random() * CATEGORIES.length);
    guard += 1;
  }
  state.usedCategoryIds.push(CATEGORIES[index].id);
  return CATEGORIES[index];
}

function buildRankings(room, state) {
  const active = activePlayers(room);
  state.rankings = shuffle(
    active.map((player) => {
      let total = 0;
      let count = 0;
      for (const ratings of Object.values(state.ratings)) {
        const value = Number(ratings?.[player.id]);
        if (Number.isFinite(value)) {
          total += value;
          count += 1;
        }
      }
      return {
        playerId: player.id,
        name: player.name,
        score: count ? Math.round((total / count) * 10) / 10 : 5,
      };
    }),
  );
  state.phase = "guess";
  state.round = 1;
  state.guesses = {};
  state.reveal = null;
  state.endsAt = Date.now() + configFor(room.mode).guessMs;
}

function currentPair(room, state) {
  return {
    current: state.rankings[state.round - 1] || null,
    next: state.rankings[state.round] || null,
  };
}

function resolveGuess(room, state) {
  const { current, next } = currentPair(room, state);
  if (!current || !next) {
    state.done = true;
    return "results";
  }

  const correctAnswer = next.score >= current.score ? "higher" : "lower";
  const validGuesses = Object.fromEntries(
    Object.entries(state.guesses).filter(
      ([playerId, value]) =>
        room.players.has(playerId) && (value === "higher" || value === "lower"),
    ),
  );
  const roundPoints = [];
  for (const [playerId, value] of Object.entries(validGuesses)) {
    if (value !== correctAnswer) continue;
    room.scores[playerId] = Number(room.scores[playerId] || 0) + 1;
    roundPoints.push({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: 1,
    });
  }

  state.reveal = {
    category: state.category.category,
    current: { ...current },
    next: { ...next },
    correctAnswer,
    guesses: Object.entries(validGuesses).map(([playerId, value]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      value,
    })),
    roundPoints,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(room.mode).revealMs;
}

const higherLower = {
  id: "higher-or-lower",
  name: "Higher / Lower",
  description: "Rate the room, then guess whether the next player scores higher or lower.",
  emoji: "📈",
  accent: "teal",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "poll",
      round: 0,
      rounds: configFor(room.mode).rounds,
      category: chooseCategory({ usedCategoryIds: [] }),
      ratings: {},
      rankings: [],
      guesses: {},
      reveal: null,
      usedCategoryIds: [],
      done: false,
      endsAt: null,
    };
    state.usedCategoryIds.push(state.category.id);
    room.state = state;
    state.endsAt = Date.now() + configFor(room.mode).pollMs;
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "poll" && event.type === "ratings") {
      if (state.ratings[playerId] !== undefined) {
        throw failure("already_rated", "You already rated the room");
      }
      const active = activePlayers(room);
      const others = active.filter((player) => player.id !== playerId);
      const submitted = event.ratings && typeof event.ratings === "object"
        ? event.ratings
        : {};
      const normalized = {};
      for (const player of others) {
        const value = Number(submitted[player.id]);
        if (!Number.isFinite(value) || value < 1 || value > 10) {
          throw failure("invalid_ratings", "Rate every other player from 1 to 10");
        }
        normalized[player.id] = Math.round(value);
      }
      state.ratings[playerId] = normalized;
      if (active.every((player) => state.ratings[player.id] !== undefined)) {
        buildRankings(room, state);
      }
      return;
    }

    if (state.phase === "guess" && event.type === "guess") {
      if (state.guesses[playerId] !== undefined) {
        throw failure("already_guessed", "You already made this call");
      }
      const value = String(event.value || "");
      if (value !== "higher" && value !== "lower") {
        throw failure("invalid_guess", "Choose higher or lower");
      }
      state.guesses[playerId] = value;
      if (activePlayers(room).every((player) => state.guesses[player.id] !== undefined)) {
        resolveGuess(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "poll") {
      if (activePlayers(room).length < 2) {
        state.done = true;
        return "results";
      }
      buildRankings(room, state);
      return;
    }
    if (state.phase === "guess") {
      resolveGuess(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds || state.round >= state.rankings.length - 1) {
        state.done = true;
        return "results";
      }
      state.round += 1;
      state.guesses = {};
      state.reveal = null;
      state.phase = "guess";
      state.endsAt = Date.now() + configFor(room.mode).guessMs;
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.ratings[playerId];
    delete state.guesses[playerId];
    state.rankings = state.rankings.filter((entry) => entry.playerId !== playerId);

    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "poll" && activePlayers(room).every((player) => state.ratings[player.id] !== undefined)) {
      buildRankings(room, state);
      return;
    }
    if (state.phase === "guess" && activePlayers(room).every((player) => state.guesses[player.id] !== undefined)) {
      resolveGuess(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const active = activePlayers(room);
    if (state.phase === "poll") {
      return {
        phase: "poll",
        round: state.round,
        rounds: state.rounds,
        mode: room.mode,
        category: state.category.category,
        submitted: Object.keys(state.ratings).length,
        total: active.length,
        youSubmitted: state.ratings[viewerId] !== undefined,
        myRatings: state.ratings[viewerId] || null,
        pollMs: configFor(room.mode).pollMs,
      };
    }

    if (state.phase === "guess") {
      const { current, next } = currentPair(room, state);
      return {
        phase: "guess",
        round: state.round,
        rounds: state.rounds,
        mode: room.mode,
        category: state.category.category,
        currentName: current?.name || "",
        currentScore: current?.score ?? 0,
        nextName: next?.name || "",
        submitted: Object.keys(state.guesses).length,
        total: active.length,
        myGuess: state.guesses[viewerId] || null,
      };
    }

    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      category: state.category.category,
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    if (state.phase === "poll") {
      return {
        phase: "poll",
        round: state.round,
        rounds: state.rounds,
        category: state.category.category,
        submitted: Object.keys(state.ratings).length,
        total: activePlayers(room).length,
      };
    }
    if (state.phase === "guess") {
      const { current, next } = currentPair(room, state);
      return {
        phase: "guess",
        round: state.round,
        rounds: state.rounds,
        category: state.category.category,
        currentName: current?.name || "",
        currentScore: current?.score ?? 0,
        nextName: next?.name || "",
        submitted: Object.keys(state.guesses).length,
        total: activePlayers(room).length,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      category: state.category.category,
      reveal: state.reveal,
    };
  },
};

export default higherLower;
