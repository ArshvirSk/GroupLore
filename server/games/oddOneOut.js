import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { allSubmitted } from "../engine/primitives/textSubmit.js";
import { allVoted, publicTally, tally, topTargets, votesByVoter } from "../engine/primitives/vote.js";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/hive.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "One player gets a related prompt. Discuss, then find them",
    answerMs: 20_000,
    discussionMs: 30_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 3,
  },
  blind: {
    label: "Blind",
    description: "No discussion — answers go straight to the vote",
    answerMs: 20_000,
    discussionMs: 0,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 3,
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
  const active = activePlayers(room);
  const config = configFor(room.mode);
  state.round += 1;
  state.phase = "answer";
  state.prompt = choosePrompt(state);
  state.oddPlayerId = active[Math.floor(Math.random() * active.length)]?.id || null;
  state.answers = {};
  state.clues = [];
  state.clueAuthors = {};
  state.votes = {};
  state.reveal = null;
  state.roundPoints = {};
  state.endsAt = Date.now() + config.answerMs;
}

function buildClues(room, state) {
  state.clueAuthors = {};
  state.clues = shuffle(
    Object.entries(state.answers).map(([playerId, answer]) => {
      const clueId = randomUUID();
      state.clueAuthors[clueId] = playerId;
      return { id: clueId, answer };
    }),
  );
}

function beginDiscussion(room, state) {
  buildClues(room, state);
  const config = configFor(room.mode);
  if (config.discussionMs <= 0) {
    state.phase = "vote";
    state.endsAt = Date.now() + config.voteMs;
    return;
  }
  state.phase = "discussion";
  state.endsAt = Date.now() + config.discussionMs;
}

function resolveVote(room, state) {
  const config = configFor(room.mode);
  const validVotes = Object.fromEntries(
    Object.entries(state.votes).filter(
      ([voterId, targetId]) =>
        room.players.has(voterId) &&
        room.players.has(targetId) &&
        voterId !== targetId,
    ),
  );
  const counts = tally(validVotes);
  const top = topTargets(counts);
  const accusedId = top.length === 1 ? top[0] : null;
  const caught = Boolean(accusedId && accusedId === state.oddPlayerId);
  const roundPoints = {};

  if (caught) {
    for (const player of room.players.values()) {
      if (player.id === state.oddPlayerId) continue;
      roundPoints[player.id] = 1;
      room.scores[player.id] = Number(room.scores[player.id] || 0) + 1;
    }
  } else if (state.oddPlayerId && room.players.has(state.oddPlayerId)) {
    roundPoints[state.oddPlayerId] = 2;
    room.scores[state.oddPlayerId] =
      Number(room.scores[state.oddPlayerId] || 0) + 2;
  }

  state.reveal = {
    prompt: state.prompt?.text || "",
    oddPrompt: state.prompt?.odd || "",
    oddPlayerId: state.oddPlayerId,
    oddName: room.players.get(state.oddPlayerId)?.name || "Player",
    accusedId,
    accusedName: accusedId
      ? room.players.get(accusedId)?.name || "Player"
      : null,
    caught,
    noConsensus: top.length !== 1,
    tally: publicTally(room, counts),
    voters: votesByVoter(room, validVotes),
    clues: state.clues.map((clue) => {
      const playerId = state.clueAuthors[clue.id];
      return {
        playerId,
        name: room.players.get(playerId)?.name || "Player",
        answer: clue.answer,
      };
    }),
    roundPoints: Object.entries(roundPoints).map(([playerId, points]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points,
    })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const oddOneOut = {
  id: "odd-one-out",
  name: "Odd One Out",
  description: "Everyone gets a prompt, but one player gets a different one. Blend in.",
  emoji: "🎭",
  accent: "teal",
  minPlayers: 4,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "answer",
      round: 0,
      rounds: configFor(room.mode).rounds,
      prompt: null,
      oddPlayerId: null,
      answers: {},
      clues: [],
      clueAuthors: {},
      votes: {},
      reveal: null,
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

    if (state.phase === "answer" && event.type === "answer") {
      if (state.answers[playerId] !== undefined) {
        throw failure("already_answered", "You already answered");
      }
      const answer = String(event.value ?? "").trim().slice(0, 100);
      if (!answer) throw failure("answer_required", "Type an answer first");
      state.answers[playerId] = answer;
      if (allSubmitted(activePlayers(room), state.answers)) {
        beginDiscussion(room, state);
      }
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (state.votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted");
      }
      const targetId = String(event.targetPlayerId || "");
      if (!room.players.has(targetId)) {
        throw failure("invalid_target", "That player is not in the room");
      }
      if (targetId === playerId) {
        throw failure("cannot_vote_self", "Pick someone else");
      }
      state.votes[playerId] = targetId;
      if (allVoted(activePlayers(room), state.votes)) {
        resolveVote(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    const config = configFor(room.mode);
    if (!state || state.done) return "results";

    if (state.phase === "answer") {
      beginDiscussion(room, state);
      return;
    }
    if (state.phase === "discussion") {
      state.phase = "vote";
      state.endsAt = Date.now() + config.voteMs;
      return;
    }
    if (state.phase === "vote") {
      resolveVote(room, state);
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
    delete state.votes[playerId];

    if (playerId === state.oddPlayerId) {
      state.done = true;
      return "results";
    }
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "answer" && allSubmitted(activePlayers(room), state.answers)) {
      beginDiscussion(room, state);
      return;
    }
    if (state.phase === "vote" && allVoted(activePlayers(room), state.votes)) {
      resolveVote(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(room.mode);
    const active = activePlayers(room);
    const isOdd = state.oddPlayerId === viewerId;
    const yourPrompt = isOdd ? state.prompt?.odd : state.prompt?.text;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      isOdd,
      answerMs: config.answerMs,
      submitted: Object.keys(state.answers).length,
      total: active.length,
      youSubmitted: state.answers[viewerId] !== undefined,
    };

    if (state.phase === "answer") {
      return {
        ...base,
        prompt: yourPrompt || "",
        discussionMs: config.discussionMs,
      };
    }
    if (state.phase === "discussion") {
      return {
        ...base,
        prompt: yourPrompt || "",
        clues: state.clues,
        discussionMs: config.discussionMs,
      };
    }
    if (state.phase === "vote") {
      return {
        ...base,
        prompt: yourPrompt || "",
        clues: state.clues,
        myVote: state.votes[viewerId] || null,
        votesSubmitted: Object.keys(state.votes).length,
        totalVoters: active.length,
      };
    }
    return {
      ...base,
      prompt: yourPrompt || "",
      clues: state.clues,
      myVote: state.votes[viewerId] || null,
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      submitted: Object.keys(state.answers).length,
      total: activePlayers(room).length,
    };

    if (state.phase === "answer") return base;
    if (state.phase === "discussion") {
      return { ...base, clues: state.clues };
    }
    if (state.phase === "vote") {
      return {
        ...base,
        clues: state.clues,
        votesSubmitted: Object.keys(state.votes).length,
        totalVoters: activePlayers(room).length,
      };
    }
    return {
      ...base,
      clues: state.clues,
      reveal: state.reveal,
    };
  },
};

export default oddOneOut;
