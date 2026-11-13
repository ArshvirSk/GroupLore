import { createRequire } from "node:module";
import { allVoted } from "../engine/primitives/vote.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/hotTakes.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Six takes, twelve seconds to pick a side",
    voteMs: 12_000,
    revealMs: 8_000,
    rounds: 6,
  },
  "slow-burn": {
    label: "Slow Burn",
    description: "Twenty seconds to argue your side",
    voteMs: 20_000,
    revealMs: 10_000,
    rounds: 6,
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
  let agree = 0;
  let disagree = 0;
  for (const [playerId, vote] of Object.entries(state.votes)) {
    if (!room.players.has(playerId)) continue;
    if (vote === "agree") agree += 1;
    else if (vote === "disagree") disagree += 1;
  }

  const total = agree + disagree;
  const tie = total > 0 && agree === disagree;
  const unanimous = total > 0 && (agree === 0 || disagree === 0);
  const minority =
    total === 0 || tie || unanimous ? null : agree < disagree ? "agree" : "disagree";
  const majority =
    total === 0 || tie || unanimous
      ? null
      : minority === "agree"
        ? "disagree"
        : "agree";

  const points = new Map();
  const add = (playerId, amount) => {
    points.set(playerId, (points.get(playerId) || 0) + amount);
  };

  for (const [playerId, vote] of Object.entries(state.votes)) {
    if (!room.players.has(playerId)) continue;
    if (total === 0) continue;
    if (tie || unanimous) add(playerId, 1);
    else add(playerId, vote === minority ? 2 : 1);
  }

  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }

  const agreePct = total ? Math.round((agree / total) * 100) : 0;
  state.reveal = {
    prompt: state.prompt?.text || "",
    agree,
    disagree,
    agreePct,
    disagreePct: total ? 100 - agreePct : 0,
    minority,
    majority,
    tie,
    unanimous,
    noVotes: total === 0,
    roundWinners: [...points.entries()].map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: amount,
    })),
    voters: Object.entries(state.votes)
      .filter(([playerId]) => room.players.has(playerId))
      .map(([playerId, vote]) => ({
        playerId,
        name: room.players.get(playerId)?.name || "Player",
        vote,
      })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(room.mode).revealMs;
}

const hotTakes = {
  id: "hot-takes",
  name: "Hot Takes",
  description: "Agree or disagree. The minority gets the hottest take points.",
  emoji: "🌶️",
  accent: "pink",
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
    if (state.done) return "results";
    if (state.phase !== "vote" || event.type !== "vote") return;

    if (state.votes[playerId] !== undefined) {
      throw failure("already_voted", "You already voted");
    }
    const vote = String(event.value || "");
    if (vote !== "agree" && vote !== "disagree") {
      throw failure("invalid_vote", "Choose agree or disagree");
    }
    state.votes[playerId] = vote;

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
        prompt: state.prompt?.text || "",
        submitted: Object.keys(state.votes).length,
        total: active.length,
        myVote: state.votes[viewerId] || null,
        voteMs: configFor(room.mode).voteMs,
      };
    }

    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
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
        prompt: state.prompt?.text || "",
        submitted: Object.keys(state.votes).length,
        total: activePlayers(room).length,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      reveal: state.reveal,
    };
  },
};

export default hotTakes;
