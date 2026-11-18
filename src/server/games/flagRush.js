import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";
import { answersMatch } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const FLAGS = require("../data/prompts/modesContent.json").flag;

const MODES = {
  classic: { label: "Classic", description: "Fifteen flags with eight seconds each", rounds: 15, answerMs: 8_000, revealMs: 3_000 },
  sprint: { label: "Sprint", description: "Twenty flags, five seconds each", rounds: 20, answerMs: 5_000, revealMs: 2_500 },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.flag = choosePrompt(FLAGS, state);
  state.phase = "answer";
  state.answers = {};
  state.answerTimes = {};
  state.reveal = null;
  state.startedAt = Date.now();
  state.endsAt = state.startedAt + config.answerMs;
  return undefined;
}

function resolveRound(room, state) {
  const rows = activePlayers(room).map((player) => {
    const answer = state.answers[player.id] || "";
    const correct = Boolean(answer) && (answersMatch(answer, state.flag.answer) || answersMatch(answer, state.flag.code));
    const fraction = Math.max(0, 1 - (state.answerTimes[player.id] - state.startedAt) / configFor(MODES, room.mode).answerMs);
    const points = correct ? Math.max(100, Math.round(500 * fraction)) : 0;
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    return { playerId: player.id, name: player.name, answer, correct, points };
  });
  state.reveal = { code: state.flag.code, answer: state.flag.answer, rows, roundPoints: rows.filter((row) => row.points > 0) };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const flagRush = {
  id: "flag-rush",
  name: "Flag Rush", description: "Name the country behind the flag before the clock runs out.",
  emoji: "🏁", accent: "green", tag: "Trivia",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "answer", round: 0, rounds: configFor(MODES, room.mode).rounds,
      flag: null, answers: {}, answerTimes: {}, reveal: null,
      usedPromptIds: [], done: false, startedAt: 0, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "answer" || event.type !== "answer") return;
    if (state.answers[playerId] !== undefined) throw failure("already_answered", "You already answered");
    const answer = String(event.value ?? "").trim().slice(0, 60);
    if (!answer) throw failure("answer_required", "Type a country");
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
      code: state.flag?.code || "", submitted: Object.keys(state.answers).length,
      total: activePlayers(room).length,       hasAnswered: state.answers[viewerId] !== undefined,
      readyIds: Object.keys(state.answers),
      myAnswer: state.answers[viewerId] || null, answerMs: configFor(MODES, room.mode).answerMs,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, code: state.flag?.code || "",
      submitted: Object.keys(state.answers).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default flagRush;
