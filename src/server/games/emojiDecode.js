import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";
import { answersMatch } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const PUZZLES = require("../data/prompts/modesContent.json").emoji;

const MODES = {
  classic: { label: "Classic", description: "Twelve emoji puzzles, twenty seconds each", rounds: 12, answerMs: 20_000, revealMs: 5_000 },
  speed: { label: "Speed", description: "Ten seconds, twelve puzzles", rounds: 12, answerMs: 10_000, revealMs: 4_000 },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.puzzle = choosePrompt(PUZZLES, state);
  state.phase = "answer";
  state.answers = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.answerMs;
  return undefined;
}

function resolveRound(room, state) {
  const rows = activePlayers(room).map((player) => {
    const answer = state.answers[player.id] || "";
    const correct = Boolean(answer) && (
      answersMatch(answer, state.puzzle.answer) ||
      (state.puzzle.aliases || []).some((alias) => answersMatch(answer, alias))
    );
    const points = correct ? 200 : 0;
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    return { playerId: player.id, name: player.name, answer, correct, points };
  });
  state.reveal = {
    emojis: state.puzzle.emojis, answer: state.puzzle.answer, rows,
    roundPoints: rows.filter((row) => row.points > 0),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const emojiDecode = {
  id: "emoji-decode",
  name: "Emoji Decode", description: "Decode movies, books and characters from a handful of emoji.",
  emoji: "🧩", accent: "grape", tag: "Trivia",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "answer", round: 0, rounds: configFor(MODES, room.mode).rounds,
      puzzle: null, answers: {}, reveal: null, usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "answer" || event.type !== "answer") return;
    if (state.answers[playerId] !== undefined) throw failure("already_answered", "You already answered");
    const answer = String(event.value ?? "").trim().slice(0, 80);
    if (!answer) throw failure("answer_required", "Type your answer");
    state.answers[playerId] = answer;
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
      emojis: state.puzzle?.emojis || "", submitted: Object.keys(state.answers).length,
      total: activePlayers(room).length,       hasAnswered: state.answers[viewerId] !== undefined,
      readyIds: Object.keys(state.answers),
      myAnswer: state.answers[viewerId] || null, answerMs: configFor(MODES, room.mode).answerMs,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, emojis: state.puzzle?.emojis || "",
      submitted: Object.keys(state.answers).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default emojiDecode;
