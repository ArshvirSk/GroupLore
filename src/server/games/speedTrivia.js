import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { answersMatch } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const QUESTIONS = require("../data/prompts/buzzerTrivia.json");

const MODES = {
  classic: { label: "Classic", description: "Twelve questions, ten seconds each", rounds: 12, answerMs: 10_000, revealMs: 4_000 },
  marathon: { label: "Marathon", description: "Twenty-five questions on a six-second clock", rounds: Math.min(25, QUESTIONS.length), answerMs: 6_000, revealMs: 3_000 },
};

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function chooseQuestion(state) {
  if (state.usedIds.length >= QUESTIONS.length) state.usedIds = [];
  let question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  let guard = 0;
  while (state.usedIds.includes(question.id) && guard < 600) {
    question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    guard += 1;
  }
  state.usedIds.push(question.id);
  return question;
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.question = chooseQuestion(state);
  const wrong = shuffle(QUESTIONS.filter((item) => item.id !== state.question.id && item.answer !== state.question.answer))
    .slice(0, 3).map((item) => item.answer);
  state.options = shuffle([state.question.answer, ...wrong]);
  state.phase = "answer";
  state.answers = {};
  state.reveal = null;
  state.startedAt = Date.now();
  state.endsAt = state.startedAt + config.answerMs;
  return undefined;
}

function resolveRound(room, state) {
  const rows = activePlayers(room).map((player) => {
    const answer = state.answers[player.id] || null;
    const correct = answer !== null && answersMatch(answer, state.question.answer);
    const fraction = Math.max(0, 1 - (state.answerTimes[player.id] - state.startedAt) / configFor(MODES, room.mode).answerMs);
    const points = correct ? Math.max(300, Math.round(1000 * fraction)) : 0;
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    return { playerId: player.id, name: player.name, answer, correct, points };
  });
  state.reveal = {
    question: state.question.text, answer: state.question.answer, rows,
    roundPoints: rows.filter((row) => row.points > 0),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const speedTrivia = {
  id: "speed-trivia",
  name: "Speed Trivia", description: "Four options, ten seconds, no waiting for the room.",
  emoji: "⚡", accent: "honey", tag: "Trivia",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "answer", round: 0, rounds: configFor(MODES, room.mode).rounds,
      question: null, options: [], answers: {}, answerTimes: {}, reveal: null,
      usedIds: [], done: false, startedAt: 0, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "answer" || event.type !== "answer") return;
    if (state.answers[playerId] !== undefined) throw failure("already_answered", "You already answered");
    const answer = String(event.value ?? "").trim();
    if (!state.options.includes(answer)) throw failure("invalid_option", "Pick one of the options");
    state.answers[playerId] = answer;
    state.answerTimes[playerId] = Date.now();
    if (activePlayers(room).every((player) => state.answers[player.id] !== undefined)) resolveRound(room, state);
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "answer") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.answers[playerId];
    delete state.answerTimes[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "answer" && activePlayers(room).every((player) => state.answers[player.id] !== undefined)) {
      resolveRound(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      question: state.question?.text || "", options: state.options,
      submitted: Object.keys(state.answers).length, total: activePlayers(room).length,
      hasAnswered: state.answers[viewerId] !== undefined,
      readyIds: Object.keys(state.answers),
      myAnswer: state.answers[viewerId] || null, answerMs: configFor(MODES, room.mode).answerMs,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      question: state.question?.text || "", options: state.options,
      submitted: Object.keys(state.answers).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default speedTrivia;
