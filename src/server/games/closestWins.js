import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";

const require = createRequire(import.meta.url);
const QUESTIONS = require("../data/prompts/modesContent.json").closestWins;

const MODES = {
  classic: { label: "Classic", description: "Eight estimation questions, closest wins", rounds: 8, guessMs: 30_000, revealMs: 8_000, wagers: false },
  bet: { label: "Bet", description: "Wager points on your own estimate", rounds: 6, guessMs: 35_000, revealMs: 9_000, wagers: true },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.question = choosePrompt(QUESTIONS, state);
  state.phase = "guess";
  state.guesses = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.guessMs;
  return undefined;
}

function resolveRound(room, state) {
  const entries = activePlayers(room)
    .filter((player) => Number.isFinite(Number(state.guesses[player.id]?.value)))
    .map((player) => {
      const guess = state.guesses[player.id];
      return {
        playerId: player.id, name: player.name, value: Number(guess.value),
        wager: Number(guess.wager) || 0,
        distance: Math.abs(Number(guess.value) - state.question.answer),
        over: Number(guess.value) > state.question.answer,
      };
    })
    .sort((a, b) => a.distance - b.distance || Number(a.over) - Number(b.over));
  const pot = entries.reduce((total, entry) => total + entry.wager, 0);
  const winner = entries[0] || null;
  if (winner) {
    winner.points = configFor(MODES, room.mode).wagers ? 100 + pot : 200;
    room.scores[winner.playerId] = Number(room.scores[winner.playerId] || 0) + winner.points;
  }
  for (const entry of entries) {
    if (entry.wager) room.scores[entry.playerId] = Number(room.scores[entry.playerId] || 0) - entry.wager;
    delete entry.wager;
  }
  state.reveal = { question: state.question, answer: state.question.answer, unit: state.question.unit, entries, winner, pot };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const closestWins = {
  id: "closest-wins",
  name: "Closest Wins",
  description: "Everyone estimates the number. The closest answer takes the round.",
  emoji: "🎯", accent: "coral", tag: "Trivia",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "guess", round: 0, rounds: configFor(MODES, room.mode).rounds,
      question: null, guesses: {}, reveal: null, usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "guess" || event.type !== "guess") return;
    if (state.guesses[playerId] !== undefined) throw failure("already_guessed", "You already guessed");
    const value = Number(event.value);
    if (!Number.isFinite(value) || value < 0) throw failure("invalid_guess", "Enter a number");
    const wager = configFor(MODES, room.mode).wagers ? Math.max(10, Math.min(200, Number(event.wager) || 10)) : 0;
    state.guesses[playerId] = { value: Math.round(value), wager };
    if (activePlayers(room).every((player) => state.guesses[player.id] !== undefined)) resolveRound(room, state);
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "guess") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.guesses[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "guess" && activePlayers(room).every((player) => state.guesses[player.id] !== undefined)) {
      resolveRound(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      question: state.question?.text || "", unit: state.question?.unit || "",
      submitted: Object.keys(state.guesses).length, total: activePlayers(room).length,
      hasGuessed: state.guesses[viewerId] !== undefined,
      readyIds: Object.keys(state.guesses),
      wagers: configFor(MODES, room.mode).wagers,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      question: state.question?.text || "",
      submitted: Object.keys(state.guesses).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default closestWins;
