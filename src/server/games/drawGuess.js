import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { appendStroke, publicStrokes } from "../engine/primitives/canvas.js";
import { answersMatch } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const WORDS = require("../data/prompts/blindSketch.json");

const MODES = {
  classic: { label: "Classic", description: "Three rounds with ninety seconds to draw", rounds: 3, chooseMs: 20_000, drawMs: 90_000, revealMs: 9_000 },
  quick: { label: "Quick", description: "Two rounds and sixty seconds", rounds: 2, chooseMs: 15_000, drawMs: 60_000, revealMs: 7_000 },
};

function chooseWords(state, count = 3) {
  const chosen = [];
  let guard = 0;
  while (chosen.length < count && guard < 600) {
    guard += 1;
    const item = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (state.usedIds.includes(item.id) || chosen.some((entry) => entry.text === item.text)) continue;
    state.usedIds.push(item.id);
    chosen.push(item);
  }
  return chosen;
}

function beginDraw(room, state, word) {
  state.word = word;
  state.phase = "draw";
  state.strokes = [];
  state.guesses = {};
  state.correctIds = [];
  state.drawMs = configFor(MODES, room.mode).drawMs;
  state.endsAt = Date.now() + state.drawMs;
}

function beginRound(room, state) {
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  state.round += 1;
  state.drawerId = active[(state.round - 1) % active.length].id;
  state.choices = chooseWords(state);
  state.word = null;
  state.strokes = [];
  state.guesses = {};
  state.correctIds = [];
  state.reveal = null;
  state.phase = "choose";
  state.endsAt = Date.now() + configFor(MODES, room.mode).chooseMs;
  return undefined;
}

function resolveRound(room, state, reason) {
  const points = new Map();
  state.correctIds.forEach((playerId, index) => points.set(playerId, index === 0 ? 500 : 200));
  if (state.correctIds.length) points.set(state.drawerId, 300);
  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }
  state.reveal = {
    reason, word: state.word?.text || "",
    drawerId: state.drawerId, drawerName: room.players.get(state.drawerId)?.name || "Player",
    strokes: publicStrokes(state),
    correctNames: state.correctIds.map((id) => room.players.get(id)?.name || "Player"),
    roundPoints: [...points.entries()].map(([playerId, amount]) => ({
      playerId, name: room.players.get(playerId)?.name || "Player", points: amount,
    })),
    guesses: Object.entries(state.guesses).map(([playerId, list]) => ({
      playerId, name: room.players.get(playerId)?.name || "Player", guesses: list,
    })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const drawGuess = {
  id: "draw-guess",
  name: "Draw & Guess", description: "One artist, one secret word, everyone else guessing.",
  emoji: "🎨", accent: "blue", tag: "Draw",
  minPlayers: 3, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "choose", round: 0, rounds: configFor(MODES, room.mode).rounds,
      drawerId: null, choices: [], word: null, strokes: [], guesses: {},
      correctIds: [], reveal: null, usedIds: [], done: false, drawMs: 0, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "choose" && event.type === "chooseWord") {
      if (playerId !== state.drawerId) throw failure("drawer_only", "Only the artist picks the word");
      const word = state.choices.find((item) => item.id === String(event.wordId || ""));
      if (!word) throw failure("invalid_word", "Pick one of the three words");
      beginDraw(room, state, word);
      return;
    }
    if (state.phase === "draw" && event.type === "stroke") {
      if (playerId !== state.drawerId) throw failure("drawer_only", "Only the artist can draw");
      return appendStroke(state, event.stroke);
    }
    if (state.phase === "draw" && event.type === "guess") {
      if (playerId === state.drawerId) throw failure("drawer_cannot_guess", "The artist cannot guess");
      const guess = String(event.value ?? "").trim().slice(0, 80);
      if (!guess) throw failure("guess_required", "Type a guess");
      const list = state.guesses[playerId] || [];
      if (list.length >= 5) throw failure("too_many_guesses", "No more guesses this round");
      list.push(guess);
      state.guesses[playerId] = list;
      if (answersMatch(guess, state.word.text) && !state.correctIds.includes(playerId)) {
        state.correctIds.push(playerId);
        const guessers = activePlayers(room).filter((player) => player.id !== state.drawerId);
        if (guessers.every((player) => state.correctIds.includes(player.id))) {
          resolveRound(room, state, "correct");
        }
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "choose") {
      beginDraw(room, state, state.choices[0]);
      return;
    }
    if (state.phase === "draw") {
      resolveRound(room, state, state.correctIds.length ? "correct" : "timeout");
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.guesses[playerId];
    state.correctIds = state.correctIds.filter((id) => id !== playerId);
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (playerId === state.drawerId) {
      state.done = true;
      return "results";
    }
    if (state.phase === "draw") {
      const guessers = activePlayers(room).filter((player) => player.id !== state.drawerId);
      if (guessers.length && guessers.every((player) => state.correctIds.includes(player.id))) {
        resolveRound(room, state, "correct");
      }
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isDrawer = viewerId === state.drawerId;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      isDrawer, drawerId: state.drawerId,
      drawerName: room.players.get(state.drawerId)?.name || "Player",
      word: isDrawer || state.phase === "reveal" ? state.word?.text || null : null,
      choices: state.phase === "choose" && isDrawer ? state.choices : [],
      strokes: publicStrokes(state),
      correctNames: state.correctIds.map((id) => room.players.get(id)?.name || "Player"),
      myGuesses: state.guesses[viewerId] || [],
      drawMs: state.drawMs,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      drawerName: room.players.get(state.drawerId)?.name || "Player",
      strokes: publicStrokes(state),
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default drawGuess;
