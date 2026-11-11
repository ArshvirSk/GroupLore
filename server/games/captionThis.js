import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { allSubmitted } from "../engine/primitives/textSubmit.js";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/captionThis.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Four scenarios and thirty seconds to write a caption",
    rounds: 4,
    writeMs: 30_000,
    voteMs: 20_000,
    revealMs: 9_000,
  },
  quick: {
    label: "Quick",
    description: "Three faster caption rounds",
    rounds: 3,
    writeMs: 18_000,
    voteMs: 12_000,
    revealMs: 7_000,
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
  state.captions = {};
  state.choices = [];
  state.votes = {};
  state.reveal = null;
  state.endsAt = Date.now() + configFor(room.mode).writeMs;
}

function buildChoices(room, state) {
  state.choices = shuffle(
    Object.entries(state.captions)
      .filter(([playerId]) => room.players.has(playerId))
      .map(([playerId, text]) => ({
        id: randomUUID(),
        playerId,
        text,
      })),
  );
  state.votes = {};
  state.phase = "vote";
  state.endsAt = Date.now() + configFor(room.mode).voteMs;
}

function resolveVotes(room, state) {
  const byChoice = new Map();
  for (const [voterId, choiceId] of Object.entries(state.votes)) {
    if (!room.players.has(voterId)) continue;
    const choice = state.choices.find((item) => item.id === choiceId);
    if (!choice || choice.playerId === voterId) continue;
    if (!byChoice.has(choiceId)) byChoice.set(choiceId, []);
    byChoice.get(choiceId).push(voterId);
  }

  const points = new Map();
  for (const choice of state.choices) {
    const voterIds = byChoice.get(choice.id) || [];
    if (voterIds.length > 0 && room.players.has(choice.playerId)) {
      points.set(choice.playerId, (points.get(choice.playerId) || 0) + voterIds.length);
    }
  }
  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }

  state.reveal = {
    scenario: state.prompt.scenario,
    choices: state.choices.map((choice) => {
      const voterIds = byChoice.get(choice.id) || [];
      return {
        id: choice.id,
        text: choice.text,
        authorId: choice.playerId,
        authorName: room.players.get(choice.playerId)?.name || "Player",
        votes: voterIds.length,
        voters: voterIds.map((voterId) => ({
          playerId: voterId,
          name: room.players.get(voterId)?.name || "Player",
        })),
      };
    }),
    roundPoints: [...points.entries()].map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: amount,
    })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(room.mode).revealMs;
}

const captionThis = {
  id: "caption-this",
  name: "Caption This",
  description: "Write the funniest caption for a ridiculous scenario, then vote for the best.",
  emoji: "📸",
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
      captions: {},
      choices: [],
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

    if (state.phase === "write" && event.type === "caption") {
      if (state.captions[playerId] !== undefined) {
        throw failure("already_captioned", "You already wrote a caption");
      }
      const text = String(event.value ?? "").trim().slice(0, 160);
      if (!text) throw failure("caption_required", "Write a caption first");
      state.captions[playerId] = text;
      if (allSubmitted(activePlayers(room), state.captions)) {
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
      if (!choice) throw failure("invalid_choice", "That caption is not in play");
      if (choice.playerId === playerId) {
        throw failure("cannot_vote_own_caption", "You cannot vote for your own caption");
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
    delete state.captions[playerId];
    delete state.votes[playerId];
    state.choices = state.choices.filter((choice) => choice.playerId !== playerId);

    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "write" && allSubmitted(activePlayers(room), state.captions)) {
      buildChoices(room, state);
      return;
    }
    if (state.phase === "vote" && allSubmitted(activePlayers(room), state.votes)) {
      resolveVotes(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const active = activePlayers(room);
    const myChoice = state.choices.find((choice) => choice.playerId === viewerId);
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      scenario: state.prompt?.scenario || "",
      submitted: 0,
      total: active.length,
    };

    if (state.phase === "write") {
      return {
        ...base,
        submitted: Object.keys(state.captions).length,
        youSubmitted: state.captions[viewerId] !== undefined,
        writeMs: configFor(room.mode).writeMs,
      };
    }
    if (state.phase === "vote") {
      return {
        ...base,
        submitted: Object.keys(state.votes).length,
        choices: state.choices.map((choice) => ({
          id: choice.id,
          text: choice.text,
        })),
        myCaptionId: myChoice?.id || null,
        myVote: state.votes[viewerId] || null,
      };
    }
    return {
      ...base,
      submitted: Object.keys(state.votes).length,
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      scenario: state.prompt?.scenario || "",
      total: activePlayers(room).length,
    };
    if (state.phase === "write") {
      return { ...base, submitted: Object.keys(state.captions).length };
    }
    if (state.phase === "vote") {
      return {
        ...base,
        submitted: Object.keys(state.votes).length,
        choices: state.choices.map((choice) => ({
          id: choice.id,
          text: choice.text,
        })),
      };
    }
    return { ...base, reveal: state.reveal };
  },
};

export default captionThis;
