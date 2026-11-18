import { activePlayers, configFor, failure } from "./shared.js";
import { isWord, WORD_LIST } from "../engine/primitives/dictionary.js";
import { normalizeWord } from "../engine/primitives/normalize.js";

const MODES = {
  classic: { label: "Classic", description: "Three words, six guesses, four minutes", rounds: 3, maxGuesses: 6, playMs: 240_000, revealMs: 8_000 },
  blitz: { label: "Blitz", description: "Two words and four minutes", rounds: 2, maxGuesses: 6, playMs: 150_000, revealMs: 6_000 },
};

const ANSWERS = WORD_LIST.filter((word) => word.length === 5);
const WORDSET = new Set(ANSWERS);

function marksFor(guess, answer) {
  const marks = Array(5).fill("absent");
  const remaining = answer.split("");
  for (let index = 0; index < 5; index += 1) {
    if (guess[index] === answer[index]) {
      marks[index] = "correct";
      remaining[index] = null;
    }
  }
  for (let index = 0; index < 5; index += 1) {
    if (marks[index] === "correct") continue;
    const found = remaining.indexOf(guess[index]);
    if (found >= 0) {
      marks[index] = "present";
      remaining[found] = null;
    }
  }
  return marks;
}

function pickAnswer(state) {
  let answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
  let guard = 0;
  while (state.usedAnswers.includes(answer) && guard < 100) {
    answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    guard += 1;
  }
  state.usedAnswers.push(answer);
  return answer;
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.answer = pickAnswer(state);
  state.boards = Object.fromEntries(activePlayers(room).map((player) => [player.id, { guesses: [], solved: false }]));
  state.phase = "play";
  state.reveal = null;
  state.solvedOrder = [];
  state.endsAt = Date.now() + config.playMs;
  return undefined;
}

function finished(room, state) {
  return activePlayers(room).every((player) => {
    const board = state.boards[player.id];
    return !board || board.solved || board.guesses.length >= configFor(MODES, room.mode).maxGuesses;
  });
}

function resolveRound(room, state) {
  const rows = activePlayers(room).map((player) => {
    const board = state.boards[player.id] || { guesses: [], solved: false };
    const solveIndex = state.solvedOrder.indexOf(player.id);
    let points = 0;
    if (board.solved) points = Math.max(200, 600 - 100 * (board.guesses.length - 1)) + (solveIndex === 0 ? 200 : 0);
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    return {
      playerId: player.id, name: player.name, solved: board.solved,
      guesses: board.guesses.length, points,
    };
  });
  state.reveal = { answer: state.answer, rows, roundPoints: rows.filter((row) => row.points > 0) };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const wordleRace = {
  id: "wordle-race",
  name: "Wordle Race", description: "Everyone gets the same five-letter word. Solve it first.",
  emoji: "🟩", accent: "green", tag: "Strategy",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "play", round: 0, rounds: configFor(MODES, room.mode).rounds,
      answer: null, boards: {}, solvedOrder: [], usedAnswers: [], reveal: null,
      done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "play" || event.type !== "guess") return;
    const board = state.boards[playerId];
    if (!board) throw failure("not_playing", "You are not in this round");
    if (board.solved) throw failure("already_solved", "You already solved it");
    if (board.guesses.length >= configFor(MODES, room.mode).maxGuesses) throw failure("out_of_guesses", "No guesses left");
    const word = normalizeWord(event.word);
    if (word.length !== 5) throw failure("wrong_length", "Guesses must be five letters");
    if (!isWord(word) || !WORDSET.has(word)) throw failure("not_a_word", "That word is not in the dictionary");
    if (board.guesses.some((entry) => entry.word === word)) throw failure("word_used", "You already guessed that word");
    const marks = marksFor(word, state.answer);
    board.guesses.push({ word, marks });
    if (word === state.answer) {
      board.solved = true;
      state.solvedOrder.push(playerId);
    }
    if (finished(room, state)) resolveRound(room, state);
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "play") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.boards[playerId];
    state.solvedOrder = state.solvedOrder.filter((id) => id !== playerId);
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "play" && finished(room, state)) resolveRound(room, state);
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const board = state.boards[viewerId] || { guesses: [], solved: false };
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      myGuesses: board.guesses, solved: board.solved,
      maxGuesses: configFor(MODES, room.mode).maxGuesses,
      progress: activePlayers(room).map((player) => ({
        playerId: player.id, name: player.name,
        guesses: state.boards[player.id]?.guesses.length || 0,
        solved: state.boards[player.id]?.solved || false,
      })),
      playMs: configFor(MODES, room.mode).playMs,
    };
    return state.phase === "reveal" ? { ...base, answer: state.answer, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase, round: state.round, rounds: state.rounds,
      progress: activePlayers(room).map((player) => ({
        playerId: player.id, name: player.name,
        guesses: state.boards[player.id]?.guesses.length || 0,
        solved: state.boards[player.id]?.solved || false,
      })),
      answer: state.phase === "reveal" ? state.answer : null,
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
  },
};

export default wordleRace;
