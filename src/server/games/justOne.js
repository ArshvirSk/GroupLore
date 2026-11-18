import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";
import { answersMatch, normalizeText } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const WORDS = require("../data/prompts/modesContent.json").justOne;

const MODES = {
  classic: { label: "Classic", description: "Thirteen words, one guesser each round", rounds: 13, clueMs: 30_000, guessMs: 25_000, revealMs: 7_000 },
  quick: { label: "Quick", description: "Eight words with faster clues", rounds: 8, clueMs: 18_000, guessMs: 18_000, revealMs: 5_000 },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  state.round += 1;
  state.word = choosePrompt(WORDS, state);
  state.guesserId = active[(state.round - 1) % active.length].id;
  state.phase = "clue";
  state.clues = {};
  state.validClues = [];
  state.guess = null;
  state.reveal = null;
  state.endsAt = Date.now() + config.clueMs;
  return undefined;
}

function cancelDuplicates(state) {
  const groups = new Map();
  for (const [playerId, clue] of Object.entries(state.clues)) {
    const key = normalizeText(clue);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ playerId, clue });
  }
  const valid = [];
  const cancelled = [];
  for (const group of groups.values()) {
    if (group.length > 1) cancelled.push(...group);
    else valid.push(group[0]);
  }
  state.validClues = valid;
  state.cancelledClues = cancelled;
}

function startGuess(room, state) {
  cancelDuplicates(state);
  state.phase = "guess";
  state.endsAt = Date.now() + configFor(MODES, room.mode).guessMs;
}

function resolveRound(room, state, timedOut = false) {
  const guess = state.guess || "";
  const correct = !timedOut && Boolean(guess) && answersMatch(guess, state.word.word);
  if (correct) {
    for (const player of activePlayers(room)) {
      room.scores[player.id] = Number(room.scores[player.id] || 0) + (player.id === state.guesserId ? 2 : 1);
    }
  }
  state.reveal = {
    word: state.word.word, guess: guess || null, correct, timedOut,
    guesserId: state.guesserId, guesserName: room.players.get(state.guesserId)?.name || "Player",
    validClues: state.validClues,
    cancelledClues: state.cancelledClues || [],
    roundPoints: correct ? activePlayers(room).map((player) => ({
      playerId: player.id, name: player.name, points: player.id === state.guesserId ? 2 : 1,
    })) : [],
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const justOne = {
  id: "just-one",
  name: "Just One", description: "Co-op word guessing where matching clues cancel out.",
  emoji: "1️⃣", accent: "green", tag: "Write",
  minPlayers: 3, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "clue", round: 0, rounds: configFor(MODES, room.mode).rounds,
      word: null, guesserId: null, clues: {}, validClues: [], cancelledClues: [],
      guess: null, reveal: null, usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "clue" && event.type === "clue") {
      if (playerId === state.guesserId) throw failure("guesser_cannot_clue", "You are guessing this round");
      if (state.clues[playerId] !== undefined) throw failure("already_clued", "You already gave a clue");
      const clue = String(event.value ?? "").trim().slice(0, 30);
      if (!clue) throw failure("clue_required", "Give a one-word clue");
      if (normalizeText(clue).includes(normalizeText(state.word.word))) {
        throw failure("secret_spoken", "Your clue cannot contain the secret word");
      }
      state.clues[playerId] = clue;
      const writers = activePlayers(room).filter((player) => player.id !== state.guesserId);
      if (writers.every((player) => state.clues[player.id] !== undefined)) startGuess(room, state);
      return;
    }
    if (state.phase === "guess" && event.type === "guess") {
      if (playerId !== state.guesserId) throw failure("not_guesser", "Only the guesser can answer");
      if (state.guess !== null) throw failure("already_guessed", "You already guessed");
      const guess = String(event.value ?? "").trim().slice(0, 50);
      if (!guess) throw failure("guess_required", "Type your guess");
      state.guess = guess;
      resolveRound(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "clue") {
      startGuess(room, state);
      return;
    }
    if (state.phase === "guess") {
      resolveRound(room, state, true);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.clues[playerId];
    if (playerId === state.guesserId || activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    const writers = activePlayers(room).filter((player) => player.id !== state.guesserId);
    if (state.phase === "clue" && writers.every((player) => state.clues[player.id] !== undefined)) {
      startGuess(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isGuesser = viewerId === state.guesserId;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      isGuesser, guesserId: state.guesserId,
      guesserName: room.players.get(state.guesserId)?.name || "Player",
      submitted: Object.keys(state.clues).length, total: activePlayers(room).length - 1,
      hasClued: state.clues[viewerId] !== undefined,
      readyIds: Object.keys(state.clues),
      clueMs: configFor(MODES, room.mode).clueMs,
    };
    if (state.phase === "clue") return { ...base, word: isGuesser ? null : state.word.word };
    if (state.phase === "guess") {
      return {
        ...base, word: null,
        clues: state.validClues.map((entry) => entry.clue),
      };
    }
    return { ...base, word: state.word.word, reveal: state.reveal };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      guesserId: state.guesserId, guesserName: room.players.get(state.guesserId)?.name || "Player",
    };
    if (state.phase === "clue") {
      return { ...base, submitted: Object.keys(state.clues).length, total: activePlayers(room).length - 1 };
    }
    if (state.phase === "guess") {
      return { ...base, clues: state.validClues.map((entry) => entry.clue) };
    }
    return { ...base, reveal: state.reveal };
  },
};

export default justOne;
