import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { appendStroke, publicStrokes } from "../engine/primitives/canvas.js";

const require = createRequire(import.meta.url);
const WORDS = require("../data/prompts/blindSketch.json");

const MODES = {
  classic: { label: "Classic", description: "Three rounds of drawing and misinterpreting", rounds: 3, drawMs: 60_000, guessMs: 40_000, revealMs: 10_000 },
  quick: { label: "Quick", description: "Two rounds with less time", rounds: 2, drawMs: 40_000, guessMs: 25_000, revealMs: 8_000 },
};

function orderOf(room) {
  return activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt).map((player) => player.id);
}

function drawPrompt(state) {
  const used = new Set(Object.values(state.prompts));
  let item = WORDS[Math.floor(Math.random() * WORDS.length)];
  let guard = 0;
  while (used.has(item.text) && guard < 500) {
    item = WORDS[Math.floor(Math.random() * WORDS.length)];
    guard += 1;
  }
  return item.text;
}

function beginDraw(room, state) {
  state.phase = "draw";
  state.drawings = Object.fromEntries(orderOf(room).map((id) => [id, { strokes: [], done: false }]));
  state.guesses = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).drawMs;
}

function beginRound(room, state) {
  if (state.round >= state.rounds) {
    state.done = true;
    state.phase = "results";
    return "results";
  }
  state.round += 1;
  if (state.round === 1) {
    state.prompts = Object.fromEntries(orderOf(room).map((id) => [id, drawPrompt(state)]));
  }
  beginDraw(room, state);
  return undefined;
}

function startGuess(room, state) {
  state.phase = "guess";
  state.endsAt = Date.now() + configFor(MODES, room.mode).guessMs;
}

function previousOf(order, id) {
  const index = order.indexOf(id);
  return order[(index - 1 + order.length) % order.length];
}

function resolveRound(room, state) {
  const order = orderOf(room);
  const rows = order.map((id) => ({
    playerId: id,
    name: room.players.get(id)?.name || "Player",
    prompt: state.prompts[id],
    guess: state.guesses[previousOf(order, id)] || "(no guess)",
    artistName: room.players.get(previousOf(order, id))?.name || "Player",
    strokes: publicStrokes(state.drawings[previousOf(order, id)] || { strokes: [] }),
  }));
  state.reveal = { round: state.round, rows };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

function startNextRound(room, state) {
  const order = orderOf(room);
  state.prompts = Object.fromEntries(order.map((id) => [id, state.guesses[previousOf(order, id)] || "(blank)"]));
  beginDraw(room, state);
  if (state.round >= state.rounds) {
    state.done = true;
    state.phase = "results";
    return "results";
  }
  state.round += 1;
  return undefined;
}

const drawTelephone = {
  id: "draw-telephone",
  name: "Draw Telephone", description: "A drawing becomes a guess, then a drawing, then chaos.",
  emoji: "📞", accent: "honey", tag: "Draw",
  minPlayers: 3, maxPlayers: 10, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "draw", round: 0, rounds: configFor(MODES, room.mode).rounds,
      prompts: {}, drawings: {}, guesses: {}, reveal: null,
      done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "draw" && event.type === "stroke") {
      const drawing = state.drawings[playerId];
      if (!drawing) throw failure("not_playing", "You have no drawing this round");
      if (drawing.done) throw failure("already_done", "You already finished your drawing");
      return appendStroke(drawing, event.stroke);
    }
    if (state.phase === "draw" && event.type === "done") {
      const drawing = state.drawings[playerId];
      if (!drawing) throw failure("not_playing", "You have no drawing this round");
      if (drawing.done) throw failure("already_done", "You already finished your drawing");
      drawing.done = true;
      room.scores[playerId] = Number(room.scores[playerId] || 0) + 100;
      if (orderOf(room).every((id) => state.drawings[id]?.done)) startGuess(room, state);
      return;
    }
    if (state.phase === "guess" && event.type === "guess") {
      if (state.guesses[playerId] !== undefined) throw failure("already_guessed", "You already guessed");
      const guess = String(event.value ?? "").trim().slice(0, 80);
      if (!guess) throw failure("guess_required", "Write what you see");
      state.guesses[playerId] = guess;
      room.scores[playerId] = Number(room.scores[playerId] || 0) + 50;
      if (orderOf(room).every((id) => state.guesses[id] !== undefined)) resolveRound(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "draw") {
      for (const id of orderOf(room)) {
        if (state.drawings[id] && !state.drawings[id].done) {
          state.drawings[id].done = true;
          room.scores[id] = Number(room.scores[id] || 0) + 100;
        }
      }
      startGuess(room, state);
      return;
    }
    if (state.phase === "guess") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      return startNextRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.drawings[playerId];
    delete state.prompts[playerId];
    delete state.guesses[playerId];
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "draw" && orderOf(room).every((id) => state.drawings[id]?.done)) {
      startGuess(room, state);
    }
    if (state.phase === "guess" && orderOf(room).every((id) => state.guesses[id] !== undefined)) {
      resolveRound(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const order = orderOf(room);
    const sourceId = previousOf(order, viewerId);
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      myPrompt: state.prompts[viewerId] || null,
      myStrokes: publicStrokes(state.drawings[viewerId] || { strokes: [] }),
      drawingDone: Boolean(state.drawings[viewerId]?.done),
      doneIds: order.filter((id) => state.drawings[id]?.done),
      doneCount: order.filter((id) => state.drawings[id]?.done).length,
      total: order.length,
      sourceName: room.players.get(sourceId)?.name || "Player",
      sourceStrokes: state.phase === "guess" || state.phase === "reveal"
        ? publicStrokes(state.drawings[sourceId] || { strokes: [] })
        : [],
      hasGuessed: state.guesses[viewerId] !== undefined,
      guessCount: Object.keys(state.guesses).length,
      drawMs: configFor(MODES, room.mode).drawMs,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase, round: state.round, rounds: state.rounds,
      doneCount: orderOf(room).filter((id) => state.drawings[id]?.done).length,
      guessCount: Object.keys(state.guesses).length,
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
  },
};

export default drawTelephone;
