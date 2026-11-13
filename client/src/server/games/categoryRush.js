import { createRequire } from "node:module";
import { allSubmitted, normalizeText } from "../engine/primitives/textSubmit.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/categoryRush.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Five categories and twenty seconds to think",
    rounds: 5,
    answerMs: 20_000,
    revealMs: 8_000,
  },
  speed: {
    label: "Speed",
    description: "Ten seconds and no second-guessing",
    rounds: 5,
    answerMs: 10_000,
    revealMs: 6_000,
  },
};

function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function configFor(mode) {
  return MODES[mode] || MODES.classic;
}

function activePlayers(room) {
  return [...room.players.values()].filter((player) => player.connected);
}

function choosePrompt(state) {
  if (state.usedPromptIds.length >= PROMPTS.length) state.usedPromptIds = [];
  let index = Math.floor(Math.random() * PROMPTS.length);
  let guard = 0;
  while (state.usedPromptIds.includes(PROMPTS[index].id) && guard < 500) {
    index = Math.floor(Math.random() * PROMPTS.length);
    guard += 1;
  }
  state.usedPromptIds.push(PROMPTS[index].id);
  return PROMPTS[index];
}

function beginRound(room, state) {
  state.round += 1;
  state.phase = "answer";
  state.prompt = choosePrompt(state);
  state.answers = {};
  state.groups = [];
  state.roundPoints = {};
  state.endsAt = Date.now() + configFor(room.mode).answerMs;
}

function resolveRound(room, state) {
  const entries = Object.entries(state.answers)
    .filter(([playerId]) => room.players.has(playerId))
    .map(([playerId, answer]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      answer,
    }));
  const byKey = new Map();

  for (const entry of entries) {
    const key = normalizeText(entry.answer);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(entry);
  }

  state.groups = [...byKey.entries()]
    .map(([key, group], index) => ({
      id: `group-${index}`,
      key,
      answer: group[0].answer,
      playerIds: group.map((entry) => entry.playerId),
      names: group.map((entry) => entry.name),
      points: group.length === 1 ? 2 : 1,
    }))
    .sort((a, b) => b.points - a.points || a.answer.localeCompare(b.answer));

  state.roundPoints = {};
  for (const group of state.groups) {
    for (const playerId of group.playerIds) {
      state.roundPoints[playerId] = group.points;
      room.scores[playerId] =
        Number(room.scores[playerId] || 0) + group.points;
    }
  }

  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(room.mode).revealMs;
}

const categoryRush = {
  id: "category-rush",
  name: "Category Rush",
  description: "One category, one letter, one answer. Unique answers score more.",
  emoji: "💡",
  accent: "honey",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "answer",
      round: 0,
      rounds: configFor(room.mode).rounds,
      prompt: null,
      answers: {},
      groups: [],
      roundPoints: {},
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginRound(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "answer" || event.type !== "answer") return;
    if (state.answers[playerId] !== undefined) {
      throw failure("already_answered", "You already answered this round");
    }

    const raw = String(event.value ?? "").trim().slice(0, 80);
    const answer = raw.replace(/^the\s+/i, "");
    if (!answer) throw failure("answer_required", "Type an answer first");
    if (!answer.toUpperCase().startsWith(state.prompt.letter.toUpperCase())) {
      throw failure("wrong_letter", `Your answer must start with ${state.prompt.letter}`);
    }

    state.answers[playerId] = answer;
    if (allSubmitted(activePlayers(room), state.answers)) {
      resolveRound(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "answer") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      beginRound(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.answers[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "answer" && allSubmitted(activePlayers(room), state.answers)) {
      resolveRound(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const active = activePlayers(room);
    if (state.phase === "answer") {
      return {
        phase: "answer",
        round: state.round,
        rounds: state.rounds,
        mode: room.mode,
        category: state.prompt.category,
        letter: state.prompt.letter,
        submitted: Object.keys(state.answers).length,
        total: active.length,
        youSubmitted: state.answers[viewerId] !== undefined,
        answerMs: configFor(room.mode).answerMs,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      category: state.prompt.category,
      letter: state.prompt.letter,
      yourAnswer: state.answers[viewerId] || null,
      groups: state.groups,
      roundPoints: Object.entries(state.roundPoints).map(([playerId, points]) => ({
        playerId,
        name: room.players.get(playerId)?.name || "Player",
        points,
      })),
    };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      category: state.prompt.category,
      letter: state.prompt.letter,
    };
    if (state.phase === "answer") {
      return {
        ...base,
        submitted: Object.keys(state.answers).length,
        total: activePlayers(room).length,
      };
    }
    return {
      ...base,
      groups: state.groups.map((group) => ({
        id: group.id,
        answer: group.answer,
        names: group.names,
        points: group.points,
      })),
      roundPoints: Object.entries(state.roundPoints).map(([playerId, points]) => ({
        name: room.players.get(playerId)?.name || "Player",
        points,
      })),
    };
  },
};

export default categoryRush;
