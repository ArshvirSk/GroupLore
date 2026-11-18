import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";
import { levenshtein } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const PASSAGES = require("../data/prompts/typing.json");

const MODES = {
  classic: { label: "Classic", description: "Three passages, two minutes each", rounds: 3, raceMs: 120_000, revealMs: 9_000 },
  quick: { label: "Quick", description: "Two shorter races", rounds: 2, raceMs: 75_000, revealMs: 7_000 },
};

function clean(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function accuracyOf(text, passage) {
  const typed = clean(text);
  if (!typed) return 0;
  const distance = levenshtein(typed, clean(passage));
  return Math.max(0, 1 - distance / Math.max(1, clean(passage).length));
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.passage = choosePrompt(PASSAGES, state);
  state.phase = "race";
  state.entries = {};
  state.speedBonusId = null;
  state.reveal = null;
  state.endsAt = Date.now() + config.raceMs;
  return undefined;
}

function resolveRound(room, state) {
  const rows = activePlayers(room).map((player) => {
    const entry = state.entries[player.id];
    const accuracy = entry?.accuracy || 0;
    const points = (entry?.points || 0) + (state.speedBonusId === player.id ? 200 : 0);
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    return {
      playerId: player.id, name: player.name,
      accuracy: Math.round(accuracy * 1000) / 10,
      points, speedBonus: state.speedBonusId === player.id,
    };
  });
  state.reveal = {
    title: state.passage.title, text: state.passage.text, rows,
    roundPoints: rows.filter((row) => row.points > 0),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const typeRace = {
  id: "type-race",
  name: "Type Race", description: "Retype the passage as accurately as you can before time runs out.",
  emoji: "⌨️", accent: "blue", tag: "Real-time",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "race", round: 0, rounds: configFor(MODES, room.mode).rounds,
      passage: null, entries: {}, speedBonusId: null, reveal: null,
      usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "race" || event.type !== "text") return;
    if (state.entries[playerId]) throw failure("already_submitted", "You already submitted");
    const text = String(event.value ?? "").slice(0, 4000);
    if (!text.trim()) throw failure("text_required", "Type the passage first");
    const accuracy = accuracyOf(text, state.passage.text);
    if (accuracy >= 0.95 && !state.speedBonusId) state.speedBonusId = playerId;
    state.entries[playerId] = {
      accuracy, points: Math.round(1000 * accuracy), at: Date.now(),
    };
    if (activePlayers(room).every((player) => state.entries[player.id])) resolveRound(room, state);
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "race") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.entries[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "race" && activePlayers(room).every((player) => state.entries[player.id])) {
      resolveRound(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      title: state.passage?.title || "", text: state.passage?.text || "",
      submitted: Object.keys(state.entries).length, total: activePlayers(room).length,
      hasSubmitted: Boolean(state.entries[viewerId]),
      myAccuracy: state.entries[viewerId] ? Math.round(state.entries[viewerId].accuracy * 1000) / 10 : null,
      raceMs: configFor(MODES, room.mode).raceMs,
      readyIds: Object.keys(state.entries),
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      title: state.passage?.title || "",
      submitted: Object.keys(state.entries).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default typeRace;
