import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";

const require = createRequire(import.meta.url);
const SETS = require("../data/prompts/modesContent.json").timeline;

const MODES = {
  classic: { label: "Classic", description: "Six sets of five events", rounds: 6, orderMs: 45_000, revealMs: 9_000 },
  micro: { label: "Micro", description: "Three quick three-item sets", rounds: 3, orderMs: 25_000, revealMs: 7_000, size: 3 },
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
  let items = [...card.items].sort((a, b) => a.value - b.value);
  if (config.size) items = items.slice(0, config.size);
  state.card = { id: card.id, items };
  state.shown = shuffle(items);
  state.phase = "order";
  state.orders = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.orderMs;
  return undefined;
}

function resolveRound(room, state) {
  const correct = state.card.items.map((item) => item.label);
  const rows = activePlayers(room).map((player) => {
    const order = state.orders[player.id] || [];
    let pairs = 0;
    for (let index = 0; index < correct.length; index += 1) {
      if (order[index] === correct[index]) pairs += 1;
    }
    const exact = order.length === correct.length && order.every((label, index) => label === correct[index]);
    const points = pairs * 50 + (exact ? 100 : 0);
    room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    return { playerId: player.id, name: player.name, order, pairs, exact, points };
  });
  state.reveal = { items: state.card.items, rows, roundPoints: rows.filter((row) => row.points > 0) };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const timeline = {
  id: "timeline",
  name: "Timeline", description: "Put history in order before the clock runs out.",
  emoji: "🕰️", accent: "honey", tag: "Trivia",
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
    if (state.orders[playerId] !== undefined) throw failure("already_ordered", "You already submitted an order");
    const order = Array.isArray(event.order) ? event.order.map(String) : [];
    const labels = state.card.items.map((item) => item.label);
    if (order.length !== labels.length || new Set(order).size !== labels.length || order.some((label) => !labels.includes(label))) {
      throw failure("invalid_order", "Order every item exactly once");
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
      items: state.shown.map((item) => item.label), myOrder: state.orders[viewerId] || null,
      submitted: Object.keys(state.orders).length, total: activePlayers(room).length,
      hasOrdered: state.orders[viewerId] !== undefined,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, items: state.shown,
      submitted: Object.keys(state.orders).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default timeline;
