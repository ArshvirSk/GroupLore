import { createRequire } from "node:module";
import { turnOrder } from "../engine/primitives/turnRotation.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/fiveSecond.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Five seconds to answer, then the group judges",
    answerMs: 5_000,
    judgeMs: 10_000,
    revealMs: 6_000,
    rounds: 8,
  },
  lightning: {
    label: "Lightning",
    description: "Three seconds on the clock",
    answerMs: 3_000,
    judgeMs: 8_000,
    revealMs: 5_000,
    rounds: 8,
  },
  marathon: {
    label: "Marathon",
    description: "Ten seconds, but only six turns",
    answerMs: 10_000,
    judgeMs: 12_000,
    revealMs: 6_000,
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

function currentPlayer(room, state) {
  return room.players.get(state.currentPlayerId) || null;
}

function eligibleVoters(room, state) {
  return activePlayers(room).filter(
    (player) => player.id !== state.currentPlayerId,
  );
}

function allJudged(room, state) {
  const voters = eligibleVoters(room, state);
  return voters.length > 0 && voters.every((player) => state.votes[player.id]);
}

function beginTurn(room, state) {
  const config = configFor(room.mode);
  state.order = turnOrder(activePlayers(room));
  state.round += 1;

  if (state.order.length === 0) {
    state.done = true;
    return;
  }

  const index = (state.round - 1) % state.order.length;

  state.currentPlayerId = state.order[index];
  state.currentPlayerName =
    room.players.get(state.currentPlayerId)?.name || "Player";
  state.prompt = choosePrompt(state);
  state.answer = null;
  state.votes = {};
  state.reveal = null;
  state.phase = "answer";
  state.endsAt = Date.now() + config.answerMs;
}

function finishTurn(room, state, reason) {
  const config = configFor(room.mode);
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
  if (!state.reveal) {
    state.reveal = {
      playerId: state.currentPlayerId,
      name: state.currentPlayerName,
      prompt: state.prompt?.text || "",
      answer: null,
      success: false,
      nailed: 0,
      missed: 0,
      reason,
    };
  }
}

function resolveVotes(room, state, reason = "votes") {
  const config = configFor(room.mode);
  let nailed = 0;
  let missed = 0;
  for (const [voterId, vote] of Object.entries(state.votes)) {
    if (!room.players.has(voterId)) continue;
    if (vote === "nailed") nailed += 1;
    else if (vote === "missed") missed += 1;
  }

  const success = nailed > missed;
  if (success && room.players.has(state.currentPlayerId)) {
    room.scores[state.currentPlayerId] =
      Number(room.scores[state.currentPlayerId] || 0) + 1;
  }

  state.reveal = {
    playerId: state.currentPlayerId,
    name: state.currentPlayerName,
    prompt: state.prompt?.text || "",
    answer: state.answer,
    success,
    nailed,
    missed,
    reason,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const fiveSecond = {
  id: "five-second",
  name: "5 Second Challenge",
  description: "One player, one prompt, five seconds. Then the group decides if it counts.",
  emoji: "⚡",
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
      order: [],
      currentPlayerId: null,
      currentPlayerName: "",
      answer: null,
      votes: {},
      reveal: null,
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginTurn(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (state.done) return "results";

    if (state.phase === "answer" && event.type === "answer") {
      if (playerId !== state.currentPlayerId) {
        throw failure("not_your_turn", "It is not your turn");
      }
      if (state.answer !== null) {
        throw failure("already_answered", "You already answered");
      }
      const answer = String(event.value ?? "").trim().slice(0, 160);
      if (!answer) throw failure("answer_required", "Type an answer first");

      state.answer = answer;
      state.phase = "judge";
      state.endsAt = Date.now() + configFor(room.mode).judgeMs;
      return;
    }

    if (state.phase === "judge" && event.type === "judge") {
      if (playerId === state.currentPlayerId) {
        throw failure("cannot_judge_self", "The group judges your answer");
      }
      if (state.votes[playerId]) {
        throw failure("already_judged", "You already voted");
      }
      const vote = String(event.value || "");
      if (vote !== "nailed" && vote !== "missed") {
        throw failure("invalid_vote", "Choose nailed it or not quite");
      }
      state.votes[playerId] = vote;
      if (allJudged(room, state)) {
        resolveVotes(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "answer") {
      finishTurn(room, state, "timeout");
      return;
    }
    if (state.phase === "judge") {
      resolveVotes(room, state, "timeout");
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      beginTurn(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.votes[playerId];
    state.order = state.order.filter((id) => id !== playerId);

    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }

    if (playerId === state.currentPlayerId && state.phase !== "reveal") {
      finishTurn(room, state, "left");
      return;
    }
    if (state.phase === "judge" && allJudged(room, state)) {
      resolveVotes(room, state);
    }
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      currentPlayerId: state.currentPlayerId,
      currentPlayerName: state.currentPlayerName,
      votersTotal: eligibleVoters(room, state).length,
      votesSubmitted: Object.keys(state.votes).length,
    };

    if (state.phase === "answer") return base;
    if (state.phase === "judge") {
      return { ...base, answer: state.answer };
    }
    return {
      ...base,
      answer: state.answer,
      reveal: state.reveal,
    };
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(room.mode);
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      currentPlayerId: state.currentPlayerId,
      currentPlayerName: state.currentPlayerName,
      youAreAnswering: viewerId === state.currentPlayerId,
      answerMs: config.answerMs,
      judgeMs: config.judgeMs,
      votersTotal: eligibleVoters(room, state).length,
      votesSubmitted: Object.keys(state.votes).length,
    };

    if (state.phase === "answer") {
      return { ...base, myVote: null };
    }

    if (state.phase === "judge") {
      return {
        ...base,
        answer: state.answer,
        myVote: state.votes[viewerId] || null,
        canJudge:
          viewerId !== state.currentPlayerId && !state.votes[viewerId],
      };
    }

    return {
      ...base,
      answer: state.answer,
      myVote: state.votes[viewerId] || null,
      canJudge: false,
      reveal: state.reveal,
    };
  },
};

export default fiveSecond;
