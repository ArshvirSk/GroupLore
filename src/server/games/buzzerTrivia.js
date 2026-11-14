import { createRequire } from "node:module";
import { activePlayers, addPoints, choosePrompt, configFor, failure, pointsList } from "./shared.js";
import { answersMatch } from "../engine/primitives/normalize.js";
import { correctedArrival } from "../engine/primitives/latency.js";

const require = createRequire(import.meta.url);
const QUESTIONS = require("../data/prompts/buzzerTrivia.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Ten questions stream in; buzz when you know it",
    rounds: 10,
    minReadMs: 6_000,
    wordMs: 480,
    answerMs: 6_000,
    resultMs: 5_000,
  },
  lightning: {
    label: "Lightning",
    description: "Five seconds to buzz on shorter read-outs",
    rounds: 10,
    minReadMs: 4_000,
    wordMs: 280,
    answerMs: 5_000,
    resultMs: 4_000,
  },
};

function readDuration(question, config) {
  return Math.min(
    16_000,
    Math.max(config.minReadMs, question.text.split(/\s+/).length * config.wordMs),
  );
}

function beginQuestion(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.question = choosePrompt(QUESTIONS, state);
  state.phase = "read";
  state.buzzerId = null;
  state.buzzAt = null;
  state.buzzArrivals = {};
  state.lockedOut = [];
  state.answerValue = null;
  state.reveal = null;
  state.points = new Map();
  state.questionStartedAt = Date.now();
  state.readMs = readDuration(state.question, config);
  state.buzzOpenAt = state.questionStartedAt + 400;
  state.endsAt = state.questionStartedAt + state.readMs;
  return undefined;
}

function finishQuestion(room, state, reason) {
  const config = configFor(MODES, room.mode);
  state.reveal = {
    question: state.question,
    answer: state.question.answer,
    reason,
    buzzerId: state.buzzerId,
    buzzerName: state.buzzerId
      ? room.players.get(state.buzzerId)?.name || "Player"
      : null,
    lockedOut: state.lockedOut.map((playerId) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
    })),
    roundPoints: pointsList(room, state.points || new Map()),
  };
  state.phase = "result";
  state.endsAt = Date.now() + config.resultMs;
}

const buzzerTrivia = {
  id: "buzzer-trivia",
  name: "Buzzer Trivia",
  description: "The question streams in. Buzz first, answer fast, don't guess wrong.",
  emoji: "🔔",
  accent: "coral",
  tag: "Trivia",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const state = {
      phase: "read",
      round: 0,
      rounds: config.rounds,
      question: null,
      buzzerId: null,
      buzzAt: null,
      buzzArrivals: {},
      lockedOut: [],
      answerValue: null,
      reveal: null,
      points: new Map(),
      usedPromptIds: [],
      done: false,
      endsAt: null,
      readMs: config.minReadMs,
      questionStartedAt: 0,
      buzzOpenAt: 0,
    };
    room.state = state;
    beginQuestion(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.lockedOut.includes(playerId)) {
      throw failure("locked_out", "You are locked out of this question");
    }

    if (state.phase === "read" && event.type === "buzz") {
      const now = Date.now();
      if (now < state.buzzOpenAt) throw failure("buzz_too_early", "Wait for the question");
      state.buzzArrivals[playerId] = {
        arrivedAt: now,
        correctedAt: correctedArrival(room, playerId, now),
      };
      state.buzzerId = playerId;
      state.buzzAt = state.buzzArrivals[playerId].correctedAt;
      state.phase = "answer";
      state.answerValue = null;
      state.endsAt = now + configFor(MODES, room.mode).answerMs;
      return;
    }

    if (state.phase === "answer" && event.type === "buzz") {
      // A second buzz within 80ms gets the latency correction. After that the
      // buzzer is locked and must answer.
      const first = state.buzzArrivals[state.buzzerId];
      const now = Date.now();
      if (!first || now - first.arrivedAt > 80) return;
      const correctedAt = correctedArrival(room, playerId, now);
      if (correctedAt < first.correctedAt) {
        state.buzzArrivals[playerId] = { arrivedAt: now, correctedAt };
        state.buzzerId = playerId;
        state.buzzAt = correctedAt;
        state.answerValue = null;
      }
      return;
    }

    if (state.phase === "answer" && event.type === "answer") {
      if (playerId !== state.buzzerId) {
        throw failure("not_buzzer", "Only the buzzer can answer");
      }
      if (state.answerValue !== null) {
        throw failure("already_answered", "You already answered");
      }
      const value = String(event.value ?? "").trim().slice(0, 80);
      if (!value) throw failure("answer_required", "Type an answer");
      state.answerValue = value;
      const correct =
        answersMatch(value, state.question.answer) ||
        (state.question.aliases || []).some((alias) => answersMatch(value, alias));
      if (correct) {
        const fraction = Math.max(
          0,
          1 - (state.buzzAt - state.questionStartedAt) / Math.max(1, state.readMs),
        );
        const points = 300 + Math.round(200 * fraction);
        addPoints(room, state.points, playerId, points);
        room.scores[playerId] = Number(room.scores[playerId] || 0) + points;
        finishQuestion(room, state, "correct");
        return;
      }
      room.scores[playerId] = Number(room.scores[playerId] || 0) - 100;
      state.lockedOut.push(playerId);
      state.buzzerId = null;
      state.buzzAt = null;
      state.answerValue = null;
      if (activePlayers(room).every((player) => state.lockedOut.includes(player.id))) {
        finishQuestion(room, state, "all_wrong");
        return;
      }
      state.phase = "read";
      state.questionStartedAt = Date.now();
      state.readMs = configFor(MODES, room.mode).minReadMs;
      state.buzzOpenAt = Date.now() + 400;
      state.endsAt = Date.now() + state.readMs;
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "read") {
      finishQuestion(room, state, "timeout");
      return;
    }
    if (state.phase === "answer") {
      room.scores[state.buzzerId] =
        Number(room.scores[state.buzzerId] || 0) - 100;
      state.lockedOut.push(state.buzzerId);
      state.buzzerId = null;
      if (activePlayers(room).every((player) => state.lockedOut.includes(player.id))) {
        finishQuestion(room, state, "all_timeout");
      } else {
        state.phase = "read";
        state.questionStartedAt = Date.now();
        state.readMs = 4_000;
        state.buzzOpenAt = Date.now() + 400;
        state.endsAt = Date.now() + state.readMs;
      }
      return;
    }
    if (state.phase === "result") {
      return beginQuestion(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    state.lockedOut = state.lockedOut.filter((id) => id !== playerId);
    delete state.buzzArrivals[playerId];
    if (state.buzzerId === playerId) {
      state.buzzerId = null;
      state.buzzAt = null;
      state.phase = "read";
      state.questionStartedAt = Date.now();
      state.readMs = 4_000;
      state.buzzOpenAt = Date.now() + 400;
      state.endsAt = Date.now() + state.readMs;
    }
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
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
      category: state.question?.category || "",
      readStartedAt: state.questionStartedAt,
      readMs: state.readMs,
      buzzOpenAt: state.buzzOpenAt,
      buzzerId: state.buzzerId,
      buzzerName: state.buzzerId
        ? room.players.get(state.buzzerId)?.name || "Player"
        : null,
      isBuzzer: state.buzzerId === viewerId,
      lockedOut: state.lockedOut.includes(viewerId),
      answerMs: configFor(MODES, room.mode).answerMs,
      submitted: state.answerValue !== null,
    };
    if (state.phase === "result") {
      return { ...base, reveal: state.reveal, answer: state.question.answer };
    }
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      question: state.question?.text || "",
      readStartedAt: state.questionStartedAt,
      readMs: state.readMs,
      buzzerName: state.buzzerId
        ? room.players.get(state.buzzerId)?.name || "Player"
        : null,
    };
    return state.phase === "result" ? { ...base, reveal: state.reveal } : base;
  },
};

export default buzzerTrivia;
