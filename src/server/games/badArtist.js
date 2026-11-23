import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { appendStroke, publicStrokes } from "../engine/primitives/canvas.js";
import { answersMatch } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/badArtist.json");

const MODES = {
  classic: { label: "Classic", description: "Three terrible masterpieces", rounds: 3, drawMs: 75_000, revealMs: 9_000 },
  quick: { label: "Quick", description: "Two quick disasters", rounds: 2, drawMs: 50_000, revealMs: 7_000 },
};

function choosePrompt(state) {
  let item = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  let guard = 0;
  while (state.usedIds.includes(item.id) && guard < 100) {
    item = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    guard += 1;
  }
  state.usedIds.push(item.id);
  return item;
}

function beginRound(room, state) {
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  state.round += 1;
  state.artistId = active[(state.round - 1) % active.length].id;
  state.prompt = choosePrompt(state);
  state.strokes = [];
  state.guesses = {};
  state.correctIds = [];
  state.reveal = null;
  state.phase = "draw";
  state.endsAt = Date.now() + configFor(MODES, room.mode).drawMs;
  return undefined;
}

function resolveRound(room, state) {
  const points = new Map();
  state.correctIds.forEach((playerId, index) => points.set(playerId, index === 0 ? 400 : 150));
  if (state.correctIds.length) points.set(state.artistId, 200);
  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }
  state.reveal = {
    prompt: state.prompt.text, artistId: state.artistId,
    artistName: room.players.get(state.artistId)?.name || "Player",
    strokes: publicStrokes(state),
    correctNames: state.correctIds.map((id) => room.players.get(id)?.name || "Player"),
    roundPoints: [...points.entries()].map(([playerId, amount]) => ({
      playerId, name: room.players.get(playerId)?.name || "Player", points: amount,
    })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const badArtist = {
  id: "bad-artist",
  name: "Bad Artist", description: "Describe an absurd scene with the worst drawing possible.",
  emoji: "🖍️", accent: "coral", tag: "Draw",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "draw", round: 0, rounds: configFor(MODES, room.mode).rounds,
      artistId: null, prompt: null, strokes: [], guesses: {}, correctIds: [],
      reveal: null, usedIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "draw" && event.type === "stroke") {
      if (playerId !== state.artistId) throw failure("artist_only", "Only the artist can draw");
      return appendStroke(state, event.stroke);
    }
    if (state.phase === "draw" && event.type === "guess") {
      if (playerId === state.artistId) throw failure("artist_cannot_guess", "The artist cannot guess");
      const guess = String(event.value ?? "").trim().slice(0, 100);
      if (!guess) throw failure("guess_required", "Type a guess");
      const list = state.guesses[playerId] || [];
      if (list.length >= 4) throw failure("too_many_guesses", "No more guesses");
      list.push(guess);
      state.guesses[playerId] = list;
      if (answersMatch(guess, state.prompt.text) && !state.correctIds.includes(playerId)) {
        state.correctIds.push(playerId);
        const guessers = activePlayers(room).filter((player) => player.id !== state.artistId);
        if (guessers.every((player) => state.correctIds.includes(player.id))) resolveRound(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "draw") {
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
    state.correctIds = state.correctIds.filter((id) => id !== playerId);
    if (activePlayers(room).length < 3 || playerId === state.artistId) {
      state.done = true;
      return "results";
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isArtist = viewerId === state.artistId;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      isArtist, artistId: state.artistId,
      artistName: room.players.get(state.artistId)?.name || "Player",
      prompt: isArtist || state.phase === "reveal" ? state.prompt?.text || null : null,
      strokes: publicStrokes(state),
      correctNames: state.correctIds.map((id) => room.players.get(id)?.name || "Player"),
      myGuesses: state.guesses[viewerId] || [],
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      artistName: room.players.get(state.artistId)?.name || "Player",
      strokes: publicStrokes(state),
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default badArtist;
