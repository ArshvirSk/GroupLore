import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: { label: "Classic", description: "Three lives and a 15–35 second fuse", lives: 3, minFuseMs: 15_000, maxFuseMs: 35_000 },
  quick: { label: "Quick", description: "Two lives on a 10–20 second fuse", lives: 2, minFuseMs: 10_000, maxFuseMs: 20_000 },
};

function fuse(state, config) {
  return Date.now() + config.minFuseMs + Math.floor(Math.random() * (config.maxFuseMs - config.minFuseMs));
}

function nextHolder(state) {
  return state.aliveIds[Math.floor(Math.random() * state.aliveIds.length)] || null;
}

function startRound(room, state) {
  const config = configFor(MODES, room.mode);
  state.holderId = nextHolder(state);
  state.phase = "play";
  state.exploded = null;
  state.endsAt = fuse(state, config);
}

const hotPotato = {
  id: "hot-potato",
  name: "Hot Potato", description: "Pass the ticking potato. Do not be holding it when it pops.",
  emoji: "🥔", accent: "honey", tag: "Real-time",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
    room.state = {
      phase: "play", holderId: null, aliveIds: active.map((player) => player.id),
      lives: Object.fromEntries(active.map((player) => [player.id, configFor(MODES, room.mode).lives])),
      exploded: null, winnerId: null, done: false, endsAt: null,
    };
    startRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "play" || event.type !== "pass") return;
    if (playerId !== state.holderId) throw failure("not_holder", "You are not holding the potato");
    if (!state.aliveIds.includes(event.targetId) || event.targetId === playerId) {
      throw failure("invalid_target", "Pass to another player still in the game");
    }
    state.holderId = event.targetId;
    room.scores[playerId] = Number(room.scores[playerId] || 0) + 15;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "play") return undefined;
    const playerId = state.holderId;
    state.lives[playerId] = Math.max(0, (state.lives[playerId] || 0) - 1);
    state.exploded = { playerId, name: room.players.get(playerId)?.name || "Player", livesLeft: state.lives[playerId] };
    if (state.lives[playerId] <= 0) state.aliveIds = state.aliveIds.filter((id) => id !== playerId);
    if (state.aliveIds.length <= 1) {
      const winnerId = state.aliveIds[0] || null;
      if (winnerId) room.scores[winnerId] = Number(room.scores[winnerId] || 0) + 500;
      state.winnerId = winnerId;
      state.phase = "reveal";
      state.done = true;
      state.endsAt = null;
      return "results";
    }
    startRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    state.aliveIds = state.aliveIds.filter((id) => id !== playerId);
    delete state.lives[playerId];
    if (state.aliveIds.length < 2) {
      state.winnerId = state.aliveIds[0] || null;
      if (state.winnerId) room.scores[state.winnerId] = Number(room.scores[state.winnerId] || 0) + 500;
      state.done = true;
      state.phase = "reveal";
      return "results";
    }
    if (state.holderId === playerId) startRound(room, state);
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    return {
      phase: state.phase, mode: room.mode,
      holderId: state.holderId, holderName: room.players.get(state.holderId)?.name || "Player",
      isHolder: state.holderId === viewerId,
      lives: state.lives[viewerId] ?? 0, exploded: state.exploded, winnerId: state.winnerId,
      standings: state.aliveIds.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player", lives: state.lives[id] })),
      targets: state.aliveIds.filter((id) => id !== viewerId).map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
    };
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase, holderName: room.players.get(state.holderId)?.name || "Player",
      exploded: state.exploded, winnerId: state.winnerId,
      standings: state.aliveIds.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player", lives: state.lives[id] })),
    };
  },
};

export default hotPotato;
