import { createRequire } from "node:module";
import { activePlayers, choosePrompt, configFor, failure } from "./shared.js";

const require = createRequire(import.meta.url);
const LOTS = require("../data/prompts/modesContent.json").auction;

const MODES = {
  classic: { label: "Classic", description: "Eight lots, sealed bids, bluffs allowed", rounds: 8, bidMs: 30_000, revealMs: 9_000 },
  short: { label: "Short", description: "Five lots with faster bidding", rounds: 5, bidMs: 20_000, revealMs: 7_000 },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.lot = choosePrompt(LOTS, state);
  state.phase = "bid";
  state.bids = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.bidMs;
  return undefined;
}

function resolveBids(room, state) {
  const entries = activePlayers(room)
    .filter((player) => Number.isFinite(Number(state.bids[player.id]?.amount)))
    .map((player) => ({
      playerId: player.id, name: player.name,
      amount: Math.max(0, Math.round(Number(state.bids[player.id].amount))),
      at: state.bids[player.id].at,
    }))
    .sort((a, b) => b.amount - a.amount || a.at - b.at);
  const winner = entries[0] && entries[0].amount > 0 ? entries[0] : null;
  if (winner) {
    const profit = state.lot.value - winner.amount;
    room.scores[winner.playerId] = Number(room.scores[winner.playerId] || 0) + profit;
    winner.profit = profit;
  }
  state.reveal = { lot: state.lot, winner, bids: entries, roundPoints: winner ? [winner] : [] };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const auctionBluff = {
  id: "auction-bluff",
  name: "Auction Bluff", description: "Bid on mystery lots. The value is hidden until the hammer falls.",
  emoji: "🔨", accent: "honey", tag: "Strategy",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    for (const playerId of room.players.keys()) {
      if (!Number(room.scores[playerId])) room.scores[playerId] = 100;
    }
    room.state = {
      phase: "bid", round: 0, rounds: configFor(MODES, room.mode).rounds,
      lot: null, bids: {}, reveal: null, usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "bid" || event.type !== "bid") return;
    if (state.bids[playerId] !== undefined) throw failure("already_bid", "You already bid");
    const amount = Math.round(Number(event.value));
    if (!Number.isFinite(amount) || amount < 0) throw failure("invalid_bid", "Bid zero or more");
    if (amount > Number(room.scores[playerId] || 0)) throw failure("bid_too_high", "You cannot bid more than your bankroll");
    state.bids[playerId] = { amount, at: Date.now() };
    if (activePlayers(room).every((player) => state.bids[player.id] !== undefined)) resolveBids(room, state);
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "bid") {
      resolveBids(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.bids[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (state.phase === "bid" && activePlayers(room).every((player) => state.bids[player.id] !== undefined)) {
      resolveBids(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      hint: state.lot?.hint || "", bankroll: Number(room.scores[viewerId] || 0),
      submitted: Object.keys(state.bids).length, total: activePlayers(room).length,
      hasBid: state.bids[viewerId] !== undefined,
      readyIds: Object.keys(state.bids),
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, hint: state.lot?.hint || "",
      submitted: Object.keys(state.bids).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default auctionBluff;
