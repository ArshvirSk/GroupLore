import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  activePlayers,
  addPoints,
  choosePrompt,
  commitPoints,
  configFor,
  failure,
  pointsList,
} from "./shared.js";

const require = createRequire(import.meta.url);
const PRODUCTS = require("../data/prompts/pitchPerfect.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Four products, 35 seconds to pitch each one",
    writeMs: 35_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 4,
  },
  quick: {
    label: "Quick",
    description: "Three faster pitches with shorter timers",
    writeMs: 25_000,
    voteMs: 15_000,
    revealMs: 7_000,
    rounds: 3,
  },
};

function roundMultiplier(state) {
  return state.round >= state.rounds ? 2 : 1;
}

function beginRound(room, state) {
  state.round += 1;
  state.phase = "write";
  state.product = choosePrompt(PRODUCTS, state);
  state.submissions = {};
  state.choices = [];
  state.votes = {};
  state.reveal = null;
  state.roundPoints = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).writeMs;
}

function buildChoices(room, state) {
  state.choices = Object.entries(state.submissions)
    .filter(([playerId]) => room.players.get(playerId)?.connected)
    .map(([playerId, pitch]) => ({
      id: randomUUID(),
      playerId,
      text: pitch,
    }));
  state.phase = "vote";
  state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
  if (state.choices.length <= 1) resolveVotes(room, state);
}

function resolveVotes(room, state) {
  const points = new Map();
  const counts = new Map();
  for (const [voterId, choiceId] of Object.entries(state.votes)) {
    if (!room.players.get(voterId)?.connected) continue;
    const choice = state.choices.find((item) => item.id === choiceId);
    if (!choice || choice.playerId === voterId) continue;
    counts.set(choiceId, (counts.get(choiceId) || 0) + 1);
  }

  const multiplier = roundMultiplier(state);
  for (const choice of state.choices) {
    const received = counts.get(choice.id) || 0;
    addPoints(room, points, choice.playerId, received * 100 * multiplier);
    if (received > 0 && received === activePlayers(room).length - 1) {
      addPoints(room, points, choice.playerId, 300 * multiplier);
    }
  }

  commitPoints(room, points);
  state.roundPoints = Object.fromEntries(points);
  state.reveal = {
    product: state.product.text,
    multiplier,
    choices: state.choices
      .map((choice) => ({
        id: choice.id,
        text: choice.text,
        playerId: choice.playerId,
        name: room.players.get(choice.playerId)?.name || "Player",
        votes: counts.get(choice.id) || 0,
        points: points.get(choice.playerId) || 0,
      }))
      .sort((a, b) => b.points - a.points || b.votes - a.votes),
    roundPoints: pointsList(room, points),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const pitchPerfect = {
  id: "pitch-perfect",
  name: "Pitch Perfect",
  description: "Sell an absurd product with one killer tagline.",
  emoji: "🦈",
  accent: "honey",
  tag: "Pitch battle",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "write",
      round: 0,
      rounds: configFor(MODES, room.mode).rounds,
      product: null,
      submissions: {},
      choices: [],
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
    if (!state || state.done) return "results";

    if (state.phase === "write" && event.type === "pitch") {
      if (state.submissions[playerId]) {
        throw failure("already_pitched", "You already pitched this product");
      }
      const text = String(event.value || "").trim().slice(0, 140);
      if (!text) throw failure("pitch_required", "Write a pitch first");
      state.submissions[playerId] = text;
      if (activePlayers(room).every((player) => state.submissions[player.id])) {
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
      if (!choice) throw failure("invalid_choice", "That pitch is not in play");
      if (choice.playerId === playerId) {
        throw failure("cannot_vote_own", "You cannot vote for your own pitch");
      }
      state.votes[playerId] = choiceId;
      if (activePlayers(room).every((player) => state.votes[player.id])) {
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
    delete state.submissions[playerId];
    delete state.votes[playerId];

    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (
      state.phase === "write" &&
      activePlayers(room).every((player) => state.submissions[player.id])
    ) {
      buildChoices(room, state);
      return;
    }
    if (state.phase === "vote") {
      state.choices = state.choices.filter((choice) => choice.playerId !== playerId);
      if (activePlayers(room).every((player) => state.votes[player.id])) {
        resolveVotes(room, state);
      }
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);

    if (state.phase === "write") {
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        product: state.product?.text || "",
        submitted: Object.keys(state.submissions).length,
        total: activePlayers(room).length,
        youSubmitted: Boolean(state.submissions[viewerId]),
        writeMs: config.writeMs,
        finalRound: state.round >= state.rounds,
      };
    }

    if (state.phase === "vote") {
      const mine = state.choices.find((choice) => choice.playerId === viewerId);
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        product: state.product?.text || "",
        choices: state.choices.map((choice) => ({ id: choice.id, text: choice.text })),
        myChoiceId: mine?.id || null,
        myVote: state.votes[viewerId] || null,
        submitted: Object.keys(state.votes).length,
        total: activePlayers(room).length,
        finalRound: state.round >= state.rounds,
      };
    }

    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
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
        product: state.product?.text || "",
        submitted: Object.keys(state.submissions).length,
        total: activePlayers(room).length,
      };
    }
    if (state.phase === "vote") {
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        product: state.product?.text || "",
        choices: state.choices.map((choice) => ({ id: choice.id, text: choice.text })),
        submitted: Object.keys(state.votes).length,
        total: activePlayers(room).length,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      reveal: state.reveal,
    };
  },
};

export default pitchPerfect;
