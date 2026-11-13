import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { allSubmitted, normalizeText } from "../engine/primitives/textSubmit.js";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/bluff.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Write a convincing fake, then spot the real answer",
    writeMs: 30_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 5,
  },
  quick: {
    label: "Quick",
    description: "A faster bluff with three rounds",
    writeMs: 18_000,
    voteMs: 12_000,
    revealMs: 7_000,
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
  state.round += 1;
  state.phase = "write";
  state.prompt = choosePrompt(state);
  state.bluffs = {};
  state.choices = [];
  state.votes = {};
  state.reveal = null;
  state.exactMatches = [];
  state.roundPoints = {};
  state.endsAt = Date.now() + configFor(room.mode).writeMs;
}

function buildChoices(room, state) {
  const realKey = normalizeText(state.prompt.answer);
  const byKey = new Map();
  const choices = [
    {
      id: randomUUID(),
      text: state.prompt.answer,
      authors: [],
    },
  ];
  state.exactMatches = [];

  for (const [playerId, rawText] of Object.entries(state.bluffs)) {
    if (!room.players.has(playerId)) continue;
    const text = String(rawText).trim();
    const key = normalizeText(text);
    if (!key) continue;
    if (key === realKey) {
      state.exactMatches.push(playerId);
      continue;
    }
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.authors.includes(playerId)) existing.authors.push(playerId);
      continue;
    }
    const choice = { id: randomUUID(), text, authors: [playerId] };
    byKey.set(key, choice);
    choices.push(choice);
  }

  state.choices = shuffle(choices);
  state.phase = "vote";
  state.endsAt = Date.now() + configFor(room.mode).voteMs;

  if (state.choices.length === 1) {
    resolveVotes(room, state);
  }
}

function resolveVotes(room, state) {
  const config = configFor(room.mode);
  const votesByChoice = new Map();
  for (const [voterId, choiceId] of Object.entries(state.votes)) {
    if (!room.players.has(voterId)) continue;
    if (!votesByChoice.has(choiceId)) votesByChoice.set(choiceId, []);
    votesByChoice.get(choiceId).push(voterId);
  }

  const points = new Map();
  const add = (playerId, amount) => {
    if (!room.players.has(playerId)) return;
    points.set(playerId, (points.get(playerId) || 0) + amount);
  };

  for (const playerId of state.exactMatches) add(playerId, 1);

  const revealChoices = state.choices.map((choice) => {
    const voterIds = votesByChoice.get(choice.id) || [];
    const isReal = choice.authors.length === 0;
    if (isReal) {
      for (const voterId of voterIds) add(voterId, 2);
    } else {
      for (const authorId of choice.authors) {
        add(authorId, voterIds.length);
      }
    }
    return {
      id: choice.id,
      text: choice.text,
      isReal,
      authors: choice.authors.map((playerId) => ({
        playerId,
        name: room.players.get(playerId)?.name || "Player",
      })),
      votes: voterIds.length,
      voters: voterIds.map((playerId) => ({
        playerId,
        name: room.players.get(playerId)?.name || "Player",
      })),
    };
  });

  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }

  state.roundPoints = [...points.entries()].map(([playerId, amount]) => ({
    playerId,
    name: room.players.get(playerId)?.name || "Player",
    points: amount,
  }));
  state.reveal = {
    question: state.prompt?.question || "",
    realAnswer: state.prompt?.answer || "",
    choices: revealChoices,
    exactMatches: state.exactMatches.map((playerId) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
    })),
    roundPoints: state.roundPoints,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const bluff = {
  id: "bluff",
  name: "Bluff",
  description: "Everyone writes a fake answer. Can the group spot the real one?",
  emoji: "🎩",
  accent: "grape",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "write",
      round: 0,
      rounds: configFor(room.mode).rounds,
      prompt: null,
      bluffs: {},
      choices: [],
      votes: {},
      reveal: null,
      exactMatches: [],
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

    if (state.phase === "write" && event.type === "bluff") {
      if (state.bluffs[playerId] !== undefined) {
        throw failure("already_bluffed", "You already wrote a bluff");
      }
      const text = String(event.value ?? "").trim().slice(0, 120);
      if (!text) throw failure("answer_required", "Write a bluff first");
      state.bluffs[playerId] = text;
      if (allSubmitted(activePlayers(room), state.bluffs)) {
        buildChoices(room, state);
      }
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (state.votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted");
      }
      const choiceId = String(event.choiceId || "");
      const choice = state.choices.find((item) => item.id === choiceId);
      if (!choice) throw failure("invalid_choice", "That answer is not in play");
      if (choice.authors.includes(playerId)) {
        throw failure("cannot_vote_own_bluff", "You cannot vote for your own bluff");
      }
      state.votes[playerId] = choiceId;
      if (allSubmitted(activePlayers(room), state.votes)) {
        resolveVotes(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "write") {
      buildChoices(room, state);
      return;
    }
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
    delete state.bluffs[playerId];
    delete state.votes[playerId];

    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "write" && allSubmitted(activePlayers(room), state.bluffs)) {
      buildChoices(room, state);
      return;
    }
    if (state.phase === "vote" && allSubmitted(activePlayers(room), state.votes)) {
      resolveVotes(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(room.mode);
    const active = activePlayers(room);

    if (state.phase === "write") {
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        question: state.prompt?.question || "",
        submitted: Object.keys(state.bluffs).length,
        total: active.length,
        youSubmitted: state.bluffs[viewerId] !== undefined,
        writeMs: config.writeMs,
      };
    }

    if (state.phase === "vote") {
      const myChoice = state.choices.find((choice) =>
        choice.authors.includes(viewerId),
      );
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        question: state.prompt?.question || "",
        choices: state.choices.map((choice) => ({
          id: choice.id,
          text: choice.text,
        })),
        myChoiceId: myChoice?.id || null,
        myVote: state.votes[viewerId] || null,
        submitted: Object.keys(state.votes).length,
        total: active.length,
      };
    }

    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      question: state.prompt?.question || "",
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    if (state.phase === "write") {
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        question: state.prompt?.question || "",
        submitted: Object.keys(state.bluffs).length,
        total: activePlayers(room).length,
      };
    }
    if (state.phase === "vote") {
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        question: state.prompt?.question || "",
        choices: state.choices.map((choice) => ({
          id: choice.id,
          text: choice.text,
        })),
        submitted: Object.keys(state.votes).length,
        total: activePlayers(room).length,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      question: state.prompt?.question || "",
      reveal: state.reveal,
    };
  },
};

export default bluff;
