import { createRequire } from "node:module";
import {
  activePlayers,
  addPoints,
  choosePrompt,
  configFor,
  failure,
  pointsList,
} from "./shared.js";
import { normalizeText } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const LISTS = require("../data/prompts/scattergories.json");
const LETTERS = "ABCDEFGHIJKLMNOPRSTWY".split("");
const EXCLUDED = new Set(["Q", "U", "X", "Z", "V"]);

const MODES = {
  classic: {
    label: "Classic",
    description: "Five rounds, eight categories, ninety seconds",
    rounds: 5,
    categories: 8,
    answerMs: 90_000,
    compareMs: 12_000,
  },
  blitz: {
    label: "Blitz",
    description: "Six categories and forty-five seconds",
    rounds: 5,
    categories: 6,
    answerMs: 45_000,
    compareMs: 9_000,
  },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  const list = choosePrompt(LISTS, state);
  state.categories = list.categories.slice(0, config.categories);
  state.letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  while (EXCLUDED.has(state.letter)) {
    state.letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  state.answers = {};
  state.reveal = null;
  state.points = new Map();
  state.phase = "answer";
  state.endsAt = Date.now() + config.answerMs;
  return undefined;
}

function firstLetter(value) {
  return normalizeText(value).charAt(0).toUpperCase();
}

function resolveRound(room, state) {
  const config = configFor(MODES, room.mode);
  const normalized = {};
  for (const player of activePlayers(room)) {
    const answers = state.answers[player.id] || {};
    normalized[player.id] = Object.fromEntries(
      state.categories.map((category, index) => {
        const text = String(answers[index] || "").trim();
        return [
          index,
          {
            text,
            valid: Boolean(text) && firstLetter(text) === state.letter,
            key: normalizeText(text),
          },
        ];
      }),
    );
  }

  const points = new Map();
  const rows = state.categories.map((category, index) => {
    const counts = new Map();
    for (const entry of Object.values(normalized)) {
      if (entry[index].valid && entry[index].key) {
        counts.set(entry[index].key, (counts.get(entry[index].key) || 0) + 1);
      }
    }
    return {
      category,
      answers: Object.entries(normalized).map(([playerId, entry]) => {
        const item = entry[index];
        const shared = item.valid && (counts.get(item.key) || 0) > 1;
        const pointsEarned = item.valid && !shared ? 100 : 0;
        if (pointsEarned) addPoints(room, points, playerId, pointsEarned);
        return {
          playerId,
          name: room.players.get(playerId)?.name || "Player",
          text: item.text,
          valid: item.valid,
          shared,
          points: pointsEarned,
        };
      }),
    };
  });

  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }
  state.reveal = {
    letter: state.letter,
    rows,
    roundPoints: pointsList(room, points),
  };
  state.phase = "compare";
  state.endsAt = Date.now() + config.compareMs;
}

const scattergories = {
  id: "scattergories",
  name: "Scattergories",
  description: "Race the letter and avoid answers that match the room.",
  emoji: "🗂️",
  accent: "coral",
  tag: "Write",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const state = {
      phase: "answer",
      round: 0,
      rounds: config.rounds,
      letter: "A",
      categories: [],
      answers: {},
      reveal: null,
      points: new Map(),
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
    if (state.phase !== "answer" || event.type !== "answer") return;
    if (state.answers[playerId]) {
      throw failure("already_answered", "You already submitted answers");
    }
    const values = event.values && typeof event.values === "object" ? event.values : {};
    const answers = {};
    for (let index = 0; index < state.categories.length; index += 1) {
      const text = String(values[index] || values[state.categories[index]] || "").trim().slice(0, 60);
      if (text && firstLetter(text) !== state.letter) {
        throw failure(
          "wrong_letter",
          `“${text}” does not start with ${state.letter}`,
        );
      }
      answers[index] = text;
    }
    state.answers[playerId] = answers;
    if (activePlayers(room).every((player) => state.answers[player.id])) {
      resolveRound(room, state);
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "answer") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "compare") {
      return beginRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.answers[playerId];
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (
      state.phase === "answer" &&
      activePlayers(room).every((player) => state.answers[player.id])
    ) {
      resolveRound(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      letter: state.letter,
      categories: state.categories,
      submitted: Object.keys(state.answers).length,
      total: activePlayers(room).length,
      myAnswers: state.answers[viewerId] || {},
      answerMs: configFor(MODES, room.mode).answerMs,
    };
    return state.phase === "answer"
      ? base
      : { ...base, reveal: state.reveal };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      letter: state.letter,
      submitted: Object.keys(state.answers).length,
      total: activePlayers(room).length,
    };
    return state.phase === "answer" ? base : { ...base, reveal: state.reveal };
  },
};

export default scattergories;
