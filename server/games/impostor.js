import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { allVoted, publicTally, topTargets, tally, votesByVoter } from "../engine/primitives/vote.js";
import { allSubmitted } from "../engine/primitives/textSubmit.js";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/impostor.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "One impostor and 30 seconds to compare clues",
    impostors: 1,
    answerMs: 25_000,
    discussionMs: 30_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 3,
  },
  "double-agent": {
    label: "Double Agent",
    description: "Two impostors when four or more players join",
    impostors: 2,
    answerMs: 25_000,
    discussionMs: 30_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 3,
  },
  blind: {
    label: "Blind",
    description: "No discussion — clues go straight to a vote",
    impostors: 1,
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

function impostorCountFor(room, config) {
  if (config.impostors < 2) return 1;
  return activePlayers(room).length >= 4 ? 2 : 1;
}

function beginRound(room, state) {
  const config = configFor(room.mode);
  const playerIds = shuffle(activePlayers(room).map((player) => player.id));
  const count = impostorCountFor(room, config);

  state.round += 1;
  state.phase = "answer";
  state.prompt = choosePrompt(state);
  state.answers = {};
  state.clues = [];
  state.clueAuthors = {};
  state.votes = {};
  state.reveal = null;
  state.roundPoints = {};
  state.impostorIds = playerIds.slice(0, count);
  state.endsAt = Date.now() + config.answerMs;
}

function buildClues(room, state) {
  // The public/discussion clue id must not be a player id, otherwise a client
  // could read the raw payload and deanonymise the clue authors.
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
  const config = configFor(room.mode);
  buildClues(room, state);
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
  const caught = Boolean(accusedId && state.impostorIds.includes(accusedId));
  const roundPoints = {};

  if (caught) {
    for (const player of room.players.values()) {
      if (!state.impostorIds.includes(player.id)) {
        roundPoints[player.id] = 1;
        room.scores[player.id] = Number(room.scores[player.id] || 0) + 1;
      }
    }
  } else {
    for (const impostorId of state.impostorIds) {
      if (!room.players.has(impostorId)) continue;
      roundPoints[impostorId] = 2;
      room.scores[impostorId] = Number(room.scores[impostorId] || 0) + 2;
    }
  }

  state.reveal = {
    prompt: state.prompt,
    impostorIds: [...state.impostorIds],
    impostorNames: state.impostorIds.map(
      (playerId) => room.players.get(playerId)?.name || "Player",
    ),
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
    voteCount: Object.keys(validVotes).length,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const impostor = {
  id: "guess-impostor",
  name: "Guess the Impostor",
  description: "Everyone gets a secret prompt except one player. Blend in, then find the fake.",
  emoji: "🕵️",
  accent: "dark",
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
      impostorIds: [],
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
        throw failure("already_answered", "You already sent a clue");
      }
      const answer = String(event.value ?? "").trim().slice(0, 120);
      if (!answer) throw failure("answer_required", "Type a clue first");
      state.answers[playerId] = answer;

      if (allSubmitted(activePlayers(room), state.answers)) {
        beginDiscussion(room, state);
      }
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (state.votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted this round");
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

    if (state.impostorIds.includes(playerId)) {
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

  publicFor(room) {
    const state = room.state;
    const active = activePlayers(room);
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      submitted: Object.keys(state.answers).length,
      total: active.length,
      answerMs: configFor(room.mode).answerMs,
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
        totalVoters: active.length,
      };
    }
    return {
      ...base,
      prompt: state.reveal?.prompt?.text || "",
      clues: state.clues,
      reveal: state.reveal,
    };
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(room.mode);
    const active = activePlayers(room);
    const isImpostor = state.impostorIds.includes(viewerId);
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      isImpostor,
      submitted: Object.keys(state.answers).length,
      total: active.length,
      youSubmitted: state.answers[viewerId] !== undefined,
      answerMs: config.answerMs,
      voteMs: config.voteMs,
      discussionMs: config.discussionMs,
    };

    if (state.phase === "answer") {
      return {
        ...base,
        prompt: isImpostor ? null : state.prompt?.text || "",
        teammates: isImpostor
          ? state.impostorIds
              .filter((playerId) => playerId !== viewerId)
              .map((playerId) => room.players.get(playerId)?.name || "Player")
          : [],
      };
    }

    if (state.phase === "discussion") {
      return {
        ...base,
        prompt: isImpostor ? null : state.prompt?.text || "",
        clues: state.clues,
        promptIsSecret: isImpostor,
      };
    }

    if (state.phase === "vote") {
      return {
        ...base,
        prompt: isImpostor ? null : state.prompt?.text || "",
        clues: state.clues,
        myVote: state.votes[viewerId] || null,
        votesSubmitted: Object.keys(state.votes).length,
        totalVoters: active.length,
      };
    }

    return {
      ...base,
      prompt: state.reveal?.prompt?.text || "",
      clues: state.clues,
      myVote: state.votes[viewerId] || null,
      reveal: state.reveal,
    };
  },
};

export default impostor;
