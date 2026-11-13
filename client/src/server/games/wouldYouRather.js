import { createRequire } from "node:module";
import { allVoted } from "../engine/primitives/vote.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/wouldYouRather.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Pick a side. The majority takes a point",
    voteMs: 12_000,
    revealMs: 7_000,
    rounds: 6,
    minorityPoints: false,
  },
  minority: {
    label: "Minority Rules",
    description: "The smaller side gets two points",
    voteMs: 15_000,
    revealMs: 8_000,
    rounds: 6,
    minorityPoints: true,
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
  state.phase = "vote";
  state.prompt = choosePrompt(state);
  state.votes = {};
  state.reveal = null;
  state.endsAt = Date.now() + configFor(room.mode).voteMs;
}

function resolveVotes(room, state) {
  const config = configFor(room.mode);
  let a = 0;
  let b = 0;
  for (const [playerId, value] of Object.entries(state.votes)) {
    if (!room.players.has(playerId)) continue;
    if (value === "a") a += 1;
    else if (value === "b") b += 1;
  }
  const total = a + b;
  const tie = total > 0 && a === b;
  const minority = total === 0 || tie ? null : a < b ? "a" : "b";
  const majority = total === 0 || tie ? null : a > b ? "a" : "b";
  const points = new Map();
  const add = (playerId, amount) => {
    points.set(playerId, (points.get(playerId) || 0) + amount);
  };

  for (const [playerId, value] of Object.entries(state.votes)) {
    if (!room.players.has(playerId)) continue;
    if (total === 0) continue;
    if (tie) {
      add(playerId, 1);
    } else if (config.minorityPoints) {
      add(playerId, value === minority ? 2 : 1);
    } else {
      add(playerId, value === majority ? 1 : 0);
    }
  }

  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }

  const aPct = total ? Math.round((a / total) * 100) : 0;
  state.reveal = {
    a: state.prompt.a,
    b: state.prompt.b,
    aVotes: a,
    bVotes: b,
    aPct,
    bPct: total ? 100 - aPct : 0,
    majority,
    minority,
    tie,
    noVotes: total === 0,
    roundPoints: [...points.entries()].map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: amount,
    })),
    voters: Object.entries(state.votes)
      .filter(([playerId]) => room.players.has(playerId))
      .map(([playerId, value]) => ({
        playerId,
        name: room.players.get(playerId)?.name || "Player",
        value,
      })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const wouldYouRather = {
  id: "would-you-rather",
  name: "Would You Rather",
  description: "Two impossible choices. Pick a side and see how the group splits.",
  emoji: "🔀",
  accent: "honey",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "vote",
      round: 0,
      rounds: configFor(room.mode).rounds,
      prompt: null,
      votes: {},
      reveal: null,
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
    if (state.phase !== "vote" || event.type !== "vote") return;
    if (state.votes[playerId] !== undefined) {
      throw failure("already_voted", "You already picked a side");
    }
    const value = String(event.value || "");
    if (value !== "a" && value !== "b") {
      throw failure("invalid_vote", "Pick one of the two choices");
    }
    state.votes[playerId] = value;
    if (allVoted(activePlayers(room), state.votes)) {
      resolveVotes(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "vote") {
      resolveVotes(room, state);
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
    delete state.votes[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "vote" && allVoted(activePlayers(room), state.votes)) {
      resolveVotes(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const active = activePlayers(room);
    if (state.phase === "vote") {
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        a: state.prompt.a,
        b: state.prompt.b,
        submitted: Object.keys(state.votes).length,
        total: active.length,
        myVote: state.votes[viewerId] || null,
        voteMs: configFor(room.mode).voteMs,
        minorityMode: Boolean(configFor(room.mode).minorityPoints),
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      a: state.prompt.a,
      b: state.prompt.b,
      submitted: Object.keys(state.votes).length,
      total: active.length,
      myVote: state.votes[viewerId] || null,
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    if (state.phase === "vote") {
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        a: state.prompt.a,
        b: state.prompt.b,
        submitted: Object.keys(state.votes).length,
        total: activePlayers(room).length,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      a: state.prompt.a,
      b: state.prompt.b,
      reveal: state.reveal,
    };
  },
};

export default wouldYouRather;
