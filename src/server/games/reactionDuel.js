import { activePlayers, addPoints, configFor, failure, pointsList } from "./shared.js";
import { correctedArrival } from "../engine/primitives/latency.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "Seven reaction rounds; the fastest three score",
    rounds: 7,
    waitMinMs: 2_000,
    waitMaxMs: 6_000,
    goMs: 5_000,
    resultMs: 5_000,
  },
  sudden: {
    label: "Sudden",
    description: "First player to win three rounds takes the duel",
    rounds: 20,
    waitMinMs: 1_200,
    waitMaxMs: 4_000,
    goMs: 4_000,
    resultMs: 4_000,
  },
};

function beginWait(room, state) {
  const config = configFor(MODES, room.mode);
  state.round += 1;
  state.phase = "wait";
  state.goAt = null;
  state.taps = {};
  state.locked = [];
  state.reveal = null;
  state.endsAt =
    Date.now() +
    config.waitMinMs +
    Math.floor(Math.random() * (config.waitMaxMs - config.waitMinMs));
}

function beginGo(room, state) {
  state.phase = "go";
  state.goAt = Date.now();
  state.endsAt = state.goAt + configFor(MODES, room.mode).goMs;
}

function resolveRound(room, state) {
  const config = configFor(MODES, room.mode);
  const entries = Object.entries(state.taps)
    .map(([playerId, tap]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      arrivedAt: tap.arrivedAt,
      correctedAt: tap.correctedAt,
      reactionMs: Math.max(100, Math.round(tap.correctedAt - state.goAt)),
    }))
    .sort((a, b) => a.correctedAt - b.correctedAt);
  const points = new Map();
  const groups = [];
  for (const entry of entries) {
    const previous = groups[groups.length - 1];
    if (previous && Math.abs(previous[0].correctedAt - entry.correctedAt) <= 5) {
      previous.push(entry);
    } else {
      groups.push([entry]);
    }
  }
  const awards = [300, 200, 100];
  groups.forEach((group, index) => {
    const amount = awards[index] || 0;
    for (const entry of group) {
      if (amount) addPoints(room, points, entry.playerId, amount);
      if (amount) {
        room.scores[entry.playerId] =
          Number(room.scores[entry.playerId] || 0) + amount;
      }
      entry.points = amount;
      state.wins[entry.playerId] = (state.wins[entry.playerId] || 0) + (index === 0 ? 1 : 0);
    }
  });
  for (const entry of entries) {
    if (!entry.points) entry.points = 0;
  }
  state.reveal = {
    round: state.round,
    entries,
    locked: state.locked.map((playerId) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
    })),
    points: pointsList(room, points),
    wins: Object.entries(state.wins).map(([playerId, wins]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      wins,
    })),
  };
  state.phase = "result";
  state.endsAt = Date.now() + config.resultMs;
}

const reactionDuel = {
  id: "reaction-duel",
  name: "Reaction Duel",
  description: "Wait for green, tap first, and trust the server clock.",
  emoji: "⚡",
  accent: "honey",
  tag: "Real-time",
  minPlayers: 2,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "wait",
      round: 0,
      rounds: configFor(MODES, room.mode).rounds,
      goAt: null,
      taps: {},
      locked: [],
      wins: {},
      reveal: null,
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginWait(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (event.type !== "tap") return;
    if (state.phase === "wait") {
      if (!state.locked.includes(playerId)) {
        state.locked.push(playerId);
        room.scores[playerId] = Number(room.scores[playerId] || 0) - 100;
      }
      if (
        activePlayers(room).every(
          (player) => state.locked.includes(player.id) || state.taps[player.id],
        )
      ) {
        beginGo(room, state);
      }
      return;
    }
    if (state.phase !== "go") return;
    if (state.locked.includes(playerId)) {
      throw failure("locked_out", "You tapped early this round");
    }
    if (state.taps[playerId]) {
      throw failure("already_tapped", "You already tapped");
    }
    const arrivedAt = Date.now();
    state.taps[playerId] = {
      arrivedAt,
      correctedAt: correctedArrival(room, playerId, arrivedAt),
    };
    const active = activePlayers(room).filter(
      (player) => !state.locked.includes(player.id),
    );
    if (active.every((player) => state.taps[player.id])) {
      resolveRound(room, state);
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "wait") {
      beginGo(room, state);
      return;
    }
    if (state.phase === "go") {
      resolveRound(room, state);
      return;
    }
    if (state.phase === "result") {
      const suddenWinner = Object.values(state.wins).some((wins) => wins >= 3);
      if (suddenWinner || state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      beginWait(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.taps[playerId];
    state.locked = state.locked.filter((id) => id !== playerId);
    delete state.wins[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    if (
      state.phase === "go" &&
      activePlayers(room)
        .filter((player) => !state.locked.includes(player.id))
        .every((player) => state.taps[player.id])
    ) {
      resolveRound(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      isLocked: state.locked.includes(viewerId),
      tapped: Boolean(state.taps[viewerId]),
      wins: state.wins[viewerId] || 0,
      submitted: Object.keys(state.taps).length,
      total: activePlayers(room).length,
      reveal: state.phase === "result" ? state.reveal : null,
    };
    if (state.phase === "go") return { ...base, goAt: state.goAt };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      tapped: Object.keys(state.taps).length,
      total: activePlayers(room).length,
      reveal: state.phase === "result" ? state.reveal : null,
    };
  },
};

export default reactionDuel;
