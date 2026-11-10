import { createRequire } from "node:module";
import { allVoted } from "../engine/primitives/vote.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/overrated.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Five items, twelve seconds to pick a side",
    voteMs: 12_000,
    revealMs: 7_000,
    rounds: 5,
  },
};

function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
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
  state.endsAt = Date.now() + MODES.classic.voteMs;
}

function resolveVotes(room, state) {
  let overrated = 0;
  let underrated = 0;
  for (const [voterId, vote] of Object.entries(state.votes)) {
    if (!room.players.has(voterId)) continue;
    if (vote === "overrated") overrated += 1;
    else if (vote === "underrated") underrated += 1;
  }

  const total = overrated + underrated;
  const majority =
    overrated === underrated
      ? null
      : overrated > underrated
        ? "overrated"
        : "underrated";
  const roundWinners = [];

  for (const [voterId, vote] of Object.entries(state.votes)) {
    if (!room.players.has(voterId)) continue;
    if (majority === null || vote === majority) {
      roundWinners.push(voterId);
      room.scores[voterId] = Number(room.scores[voterId] || 0) + 1;
    }
  }

  const overPct = total ? Math.round((overrated / total) * 100) : 0;

  state.reveal = {
    prompt: state.prompt,
    overrated,
    underrated,
    overPct,
    underPct: total ? 100 - overPct : 0,
    majority,
    tie: total > 0 && majority === null,
    noVotes: total === 0,
    voteCount: total,
    roundWinners: roundWinners.map((playerId) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
    })),
    voters: Object.entries(state.votes)
      .filter(([voterId]) => room.players.has(voterId))
      .map(([voterId, vote]) => ({
        playerId: voterId,
        name: room.players.get(voterId)?.name || "Player",
        vote,
      })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + MODES.classic.revealMs;
}

const overrated = {
  id: "overrated-underrated",
  name: "Overrated / Underrated",
  description: "Pick a side on everyday opinions. The majority takes the point.",
  emoji: "⚖️",
  accent: "pink",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "vote",
      round: 0,
      rounds: MODES.classic.rounds,
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
      throw failure("already_voted", "You already voted this round");
    }
    const vote = String(event.value || "");
    if (vote !== "overrated" && vote !== "underrated") {
      throw failure("invalid_vote", "Choose overrated or underrated");
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

  publicFor(room) {
    const state = room.state;
    const active = activePlayers(room);
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      submitted: Object.keys(state.votes).length,
      total: active.length,
      myVote: null,
    };

    if (state.phase === "vote") return base;
    return { ...base, reveal: state.reveal };
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
        voteMs: MODES.classic.voteMs,
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
};

export default overrated;
