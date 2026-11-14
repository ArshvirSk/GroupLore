import { createRequire } from "node:module";
import {
  activePlayers,
  addPoints,
  choosePrompt,
  configFor,
  failure,
  pointsList,
} from "./shared.js";
import {
  answersMatch,
  isNearMiss,
} from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const QUESTIONS = require("../data/prompts/surveySays.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Eight questions, three guesses each, thirty seconds",
    rounds: 8,
    guessMs: 30_000,
    revealMs: 8_000,
  },
  "fast-money": {
    label: "Fast Money",
    description: "Three fast questions with a bigger sweep bonus",
    rounds: 3,
    guessMs: 15_000,
    revealMs: 6_000,
    sweepBonus: 100,
  },
};

function beginQuestion(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.question = choosePrompt(QUESTIONS, state);
  state.guesses = {};
  state.reveal = null;
  state.points = new Map();
  state.phase = "guess";
  state.endsAt = Date.now() + config.guessMs;
  return undefined;
}

function resolveQuestion(room, state) {
  const config = configFor(MODES, room.mode);
  const allAnswers = state.question.answers;
  const results = [];
  const pointMap = new Map();

  for (const player of activePlayers(room)) {
    const raw = state.guesses[player.id];
    const guesses = Array.isArray(raw) ? raw.slice(0, 3) : [];
    const matched = new Set();
    const nearMisses = [];
    const details = [];
    for (const guess of guesses) {
      const index = allAnswers.findIndex(
        (answer, answerIndex) =>
          !matched.has(answerIndex) &&
          (answersMatch(guess, answer.text) ||
            (answer.aliases || []).some((alias) => answersMatch(guess, alias))),
      );
      if (index >= 0) {
        matched.add(index);
        details.push({
          guess,
          answer: allAnswers[index].text,
          points: allAnswers[index].points,
        });
      } else if (
        allAnswers.some(
          (answer) =>
            isNearMiss(guess, answer.text) ||
            (answer.aliases || []).some((alias) => isNearMiss(guess, alias)),
        )
      ) {
        nearMisses.push(guess);
      }
    }
    let points = [...matched].reduce(
      (total, index) => total + allAnswers[index].points,
      0,
    );
    const sweepBonus =
      matched.size >= 3 ? config.sweepBonus || (room.mode === "fast-money" ? 100 : 50) : 0;
    points += sweepBonus;
    if (points) addPoints(room, pointMap, player.id, points);
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    results.push({
      playerId: player.id,
      name: player.name,
      matches: details,
      nearMisses,
      sweepBonus,
      points,
    });
  }

  state.reveal = {
    question: state.question,
    answers: allAnswers.map((answer, index) => ({
      ...answer,
      rank: index + 1,
      matchedBy: results
        .filter((entry) => entry.matches.some((match) => match.answer === answer.text))
        .map((entry) => entry.playerId),
    })),
    results,
    roundPoints: pointsList(room, pointMap),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const surveySays = {
  id: "survey-says",
  name: "Survey Says",
  description: "Guess the answers the group would put on the board.",
  emoji: "📊",
  accent: "honey",
  tag: "Trivia",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const state = {
      phase: "guess",
      round: 0,
      rounds: config.rounds,
      question: null,
      guesses: {},
      reveal: null,
      points: new Map(),
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginQuestion(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "guess" || event.type !== "guess") return;
    if (state.guesses[playerId]) {
      throw failure("already_guessed", "You already sent your guesses");
    }
    const values = Array.isArray(event.values)
      ? event.values.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (!values.length) throw failure("guess_required", "Type at least one guess");
    state.guesses[playerId] = values.slice(0, 3);
    if (activePlayers(room).every((player) => state.guesses[player.id])) {
      resolveQuestion(room, state);
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "guess") {
      resolveQuestion(room, state);
      return;
    }
    if (state.phase === "reveal") {
      return beginQuestion(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.guesses[playerId];
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (
      state.phase === "guess" &&
      activePlayers(room).every((player) => state.guesses[player.id])
    ) {
      resolveQuestion(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      question: state.question?.text || "",
      submitted: Object.keys(state.guesses).length,
      total: activePlayers(room).length,
      myGuesses: state.guesses[viewerId] || [],
      guessMs: configFor(MODES, room.mode).guessMs,
    };
    if (state.phase === "reveal") {
      return { ...base, reveal: state.reveal };
    }
    return {
      ...base,
      answerCount: state.question?.answers?.length || 0,
      nearMiss:
        state.guesses[viewerId]?.some((guess) =>
          state.question.answers.some((answer) =>
            isNearMiss(guess, answer.text),
          ),
        ) || false,
    };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      question: state.question?.text || "",
      submitted: Object.keys(state.guesses).length,
      total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default surveySays;
