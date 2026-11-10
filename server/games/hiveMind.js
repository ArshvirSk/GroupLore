import { createRequire } from "node:module";
import { groupAnswers } from "../engine/primitives/textSubmit.js";
import { allSubmitted } from "../engine/primitives/textSubmit.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/hive.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Five prompts and twenty seconds to agree",
    answerMs: 20_000,
    revealMs: 10_000,
    rounds: 5,
  },
  speed: {
    label: "Speed",
    description: "Ten seconds to find the group answer",
    answerMs: 10_000,
    revealMs: 6_000,
    rounds: 5,
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
  const config = configFor(room.mode);
  state.round += 1;
  state.phase = "answer";
  state.prompt = choosePrompt(state);
  state.answers = {};
  state.groups = [];
  state.roundPoints = {};
  state.endsAt = Date.now() + config.answerMs;
}

function resolveRound(room, state) {
  const config = configFor(room.mode);
  const entries = Object.entries(state.answers)
    .filter(([playerId]) => room.players.has(playerId))
    .map(([playerId, answer]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      answer,
    }));

  const groups = groupAnswers(entries);
  state.groups = groups.map((group, index) => ({
    id: `group-${index}`,
    answer: group.answer,
    playerIds: group.entries.map((entry) => entry.playerId),
    names: group.entries.map((entry) => entry.name),
    points: group.entries.length >= 2 ? group.entries.length : 0,
  }));
  state.roundPoints = {};

  for (const group of state.groups) {
    if (group.points <= 0) continue;
    for (const playerId of group.playerIds) {
      state.roundPoints[playerId] = group.points;
      room.scores[playerId] =
        Number(room.scores[playerId] || 0) + group.points;
    }
  }

  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const hiveMind = {
  id: "hive-mind",
  name: "Hive Mind",
  description: "Everyone answers the same prompt. Match the group, not your own brain.",
  emoji: "🐝",
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
    if (state.done) return "results";
    if (state.phase !== "answer" || event.type !== "answer") return;

    if (state.answers[playerId] !== undefined) {
      throw failure("already_answered", "You already answered this round");
    }
    const answer = String(event.value ?? "").trim().slice(0, 80);
    if (!answer) throw failure("answer_required", "Type an answer first");

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
        prompt: state.prompt?.text || "",
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
      prompt: state.prompt?.text || "",
      submitted: Object.keys(state.answers).length,
      total: active.length,
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
    if (state.phase === "answer") {
      return {
        phase: "answer",
        round: state.round,
        rounds: state.rounds,
        prompt: state.prompt?.text || "",
        submitted: Object.keys(state.answers).length,
        total: activePlayers(room).length,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      groups: state.groups,
      roundPoints: Object.entries(state.roundPoints).map(([playerId, points]) => ({
        playerId,
        name: room.players.get(playerId)?.name || "Player",
        points,
      })),
    };
  },
};

export default hiveMind;
