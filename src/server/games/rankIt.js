import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";

const require = createRequire(import.meta.url);
const SETS = require("../data/prompts/modesContent.json").rankIt;

const MODES = {
  classic: { label: "Classic", description: "Six ranks, four items each", rounds: 6, orderMs: 35_000, revealMs: 8_000 },
  speed: { label: "Speed", description: "Fifteen seconds to rank each set", rounds: 6, orderMs: 15_000, revealMs: 6_000 },
};

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  const card = choosePrompt(SETS, state);
  state.card = card;
  state.shown = shuffle(card.items);
  state.phase = "order";
  state.orders = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.orderMs;
  return undefined;
}

function resolveRound(room, state) {
  const correct = [...state.card.items].sort((a, b) => b.value - a.value).map((item) => item.label);
  const rows = activePlayers(room).map((player) => {
    const order = state.orders[player.id] || [];
    const correctCount = order.filter((label, index) => label === correct[index]).length;
    const points = correctCount * 100;
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    return { playerId: player.id, name: player.name, order, correctCount, points };
  });
  state.reveal = {
    prompt: state.card.prompt,
    order: correct,
    values: Object.fromEntries(state.card.items.map((item) => [item.label, item.value])),
    rows, roundPoints: rows.filter((row) => row.points > 0),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const rankIt = {
  id: "rank-it",
  name: "Rank It", description: "Rank four things by the hidden number. Exact spots pay best.",
  emoji: "📊", accent: "blue", tag: "Trivia",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "order", round: 0, rounds: configFor(MODES, room.mode).rounds,
      card: null, shown: [], orders: {}, reveal: null, usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "order" || event.type !== "order") return;
    if (state.orders[playerId] !== undefined) throw failure("already_ordered", "You already submitted a rank");
    const order = Array.isArray(event.order) ? event.order.map(String) : [];
    const labels = state.card.items.map((item) => item.label);
    if (order.length !== labels.length || new Set(order).size !== labels.length || order.some((label) => !labels.includes(label))) {
      throw failure("invalid_order", "Rank every item exactly once");
    }
    state.orders[playerId] = order;
    if (activePlayers(room).every((player) => state.orders[player.id] !== undefined)) resolveRound(room, state);
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "order") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.orders[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "order" && activePlayers(room).every((player) => state.orders[player.id] !== undefined)) {
      resolveRound(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      prompt: state.card?.prompt || "", items: state.shown.map((item) => item.label),
      myOrder: state.orders[viewerId] || null,
      submitted: Object.keys(state.orders).length, total: activePlayers(room).length,
      hasOrdered: state.orders[viewerId] !== undefined,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      prompt: state.card?.prompt || "", items: state.shown.map((item) => item.label),
      submitted: Object.keys(state.orders).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default rankIt;
