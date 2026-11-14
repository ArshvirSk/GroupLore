import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "A shared sequence grows until one player is left",
    showMs: 1_400,
    perTileMs: 2_000,
    startLength: 2,
    survivalBonus: 500,
  },
  relay: {
    label: "Relay",
    description: "One more tile every turn, with a replay each round",
    showMs: 1_800,
    perTileMs: 2_500,
    startLength: 2,
    survivalBonus: 300,
  },
};

function beginShow(room, state) {
  state.phase = "show";
  state.endsAt = Date.now() + state.config.showMs;
}

function nextLevel(room, state) {
  state.level += 1;
  state.sequence.push(Math.floor(Math.random() * 9));
  state.progress = Object.fromEntries(
    activePlayers(room).map((player) => [player.id, []]),
  );
  beginShow(room, state);
}

function finishGame(room, state) {
  state.done = true;
  const alive = activePlayers(room).filter((player) => state.alive[player.id]);
  if (alive.length === 1) {
    room.scores[alive[0].id] =
      Number(room.scores[alive[0].id] || 0) + state.config.survivalBonus;
  }
  return "results";
}

function checkLevel(room, state) {
  const alive = activePlayers(room).filter((player) => state.alive[player.id]);
  for (const player of alive) {
    room.scores[player.id] =
      Number(room.scores[player.id] || 0) + state.level * 100;
  }
  state.reveal = {
    level: state.level,
    sequence: [...state.sequence],
    survivors: alive.map((player) => ({ playerId: player.id, name: player.name })),
    roundPoints: alive.map((player) => ({
      playerId: player.id,
      name: player.name,
      points: state.level * 100,
    })),
  };
  if (alive.length <= 1) return finishGame(room, state);
  nextLevel(room, state);
  return undefined;
}

const patternMemory = {
  id: "pattern-memory",
  name: "Pattern Memory",
  description: "Watch the sequence, replay it, and survive the next level.",
  emoji: "🧠",
  accent: "mint",
  tag: "Real-time",
  minPlayers: 2,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const players = activePlayers(room);
    const state = {
      phase: "show",
      level: 0,
      sequence: [],
      config: configFor(MODES, room.mode),
      alive: Object.fromEntries(players.map((player) => [player.id, true])),
      progress: {},
      reveal: null,
      done: false,
      endsAt: null,
    };
    state.level = 0;
    state.sequence = [Math.floor(Math.random() * 9), Math.floor(Math.random() * 9)];
    state.level = 1;
    state.progress = Object.fromEntries(players.map((player) => [player.id, []]));
    room.state = state;
    beginShow(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "input" || event.type !== "tap") return;
    if (!state.alive[playerId]) throw failure("eliminated", "You are out");
    const tile = Number(event.tile);
    if (!Number.isInteger(tile) || tile < 0 || tile > 8) {
      throw failure("invalid_tile", "Choose a tile from the grid");
    }
    const progress = state.progress[playerId] || [];
    if (progress.includes(undefined)) {
      // progress is an ordered array; undefined would mean malformed input
    }
    const expected = state.sequence[progress.length];
    if (tile !== expected) {
      state.alive[playerId] = false;
      state.reveal = {
        ...(state.reveal || {}),
        eliminated: { playerId, name: room.players.get(playerId)?.name || "Player" },
      };
      const alive = activePlayers(room).filter((player) => state.alive[player.id]);
      if (alive.length <= 1) return finishGame(room, state);
      return undefined;
    }
    progress.push(tile);
    state.progress[playerId] = progress;
    const alive = activePlayers(room).filter((player) => state.alive[player.id]);
    if (
      alive.length &&
      alive.every(
        (player) =>
          (state.progress[player.id] || []).length >= state.sequence.length,
      )
    ) {
      return checkLevel(room, state);
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "show") {
      state.phase = "input";
      state.endsAt = Date.now() + state.sequence.length * state.config.perTileMs;
      return;
    }
    if (state.phase === "input") {
      for (const player of activePlayers(room)) {
        if (
          state.alive[player.id] &&
          (state.progress[player.id] || []).length < state.sequence.length
        ) {
          state.alive[player.id] = false;
        }
      }
      const alive = activePlayers(room).filter((player) => state.alive[player.id]);
      if (alive.length <= 1) return finishGame(room, state);
      return checkLevel(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.alive[playerId];
    delete state.progress[playerId];
    if (activePlayers(room).length <= 1) return finishGame(room, state);
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.level,
      rounds: null,
      level: state.level,
      alive: activePlayers(room).filter((player) => state.alive[player.id]).length,
      isAlive: Boolean(state.alive[viewerId]),
      myProgress: state.progress[viewerId] || [],
      sequenceLength: state.sequence.length,
      showSequence: state.phase === "show" ? [...state.sequence] : [],
      reveal: state.reveal,
    };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase,
      level: state.level,
      sequence: state.phase === "show" ? [...state.sequence] : [],
      alive: activePlayers(room).filter((player) => state.alive[player.id]).length,
    };
  },
};

export default patternMemory;
