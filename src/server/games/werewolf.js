import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: { label: "Classic", description: "Night actions, a day of debate, and a vote", nightMs: 40_000, dayMs: 100_000, voteMs: 40_000, revealMs: 10_000 },
  quick: { label: "Quick", description: "Faster nights and shorter debates", nightMs: 25_000, dayMs: 55_000, voteMs: 25_000, revealMs: 8_000 },
};

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function assignRoles(active) {
  const count = active.length;
  const wolfCount = count >= 9 ? 3 : count >= 7 ? 2 : 1;
  const roles = [
    ...Array(wolfCount).fill("werewolf"),
    "seer",
    ...(count >= 7 ? ["doctor"] : []),
  ];
  while (roles.length < count) roles.push("villager");
  const shuffled = shuffle(roles);
  return Object.fromEntries(active.map((player, index) => [player.id, shuffled[index]]));
}

function aliveByRole(room, state, role) {
  return state.aliveIds.filter((id) => state.roles[id] === role);
}

function checkWin(room, state) {
  const wolves = aliveByRole(room, state, "werewolf").length;
  const others = state.aliveIds.length - wolves;
  if (wolves === 0) return "village";
  if (wolves >= others) return "werewolf";
  return null;
}

function finish(room, state, winner) {
  state.winner = winner;
  state.done = true;
  state.phase = "results";
  state.endsAt = null;
  for (const playerId of state.aliveIds) {
    if (state.roles[playerId] === winner || (winner === "village" && state.roles[playerId] !== "werewolf")) {
      room.scores[playerId] = Number(room.scores[playerId] || 0) + 500;
    }
  }
}

function nightFallback(room, state) {
  const wolves = aliveByRole(room, state, "werewolf");
  const nonWolves = state.aliveIds.filter((id) => state.roles[id] !== "werewolf");
  if (!state.nightKill && wolves.length && nonWolves.length) {
    state.nightKill = nonWolves[Math.floor(Math.random() * nonWolves.length)];
  }
}

function beginNight(room, state) {
  state.day += 1;
  state.phase = "night";
  state.nightKill = null;
  state.doctorSave = null;
  state.vote = {};
  state.voteResult = null;
  state.endsAt = Date.now() + configFor(MODES, room.mode).nightMs;
}

function resolveNight(room, state) {
  nightFallback(room, state);
  const victim = state.nightKill;
  const saved = victim && state.doctorSave === victim;
  const died = victim && !saved ? victim : null;
  if (died) state.aliveIds = state.aliveIds.filter((id) => id !== died);
  state.lastNight = {
    diedId: died, diedName: died ? room.players.get(died)?.name || "Player" : null,
    saved: Boolean(saved),
  };
  state.vote = {};
  state.phase = "day";
  state.endsAt = Date.now() + configFor(MODES, room.mode).dayMs;
  const winner = checkWin(room, state);
  if (winner) finish(room, state, winner);
}

function resolveVote(room, state) {
  const counts = new Map();
  for (const target of Object.values(state.vote)) counts.set(target, (counts.get(target) || 0) + 1);
  const highest = Math.max(0, ...counts.values());
  const accused = [...counts.entries()].filter(([, count]) => count === highest).map(([id]) => id);
  const eliminated = accused.length === 1 ? accused[0] : null;
  if (eliminated) state.aliveIds = state.aliveIds.filter((id) => id !== eliminated);
  state.voteResult = {
    eliminatedId: eliminated,
    eliminatedName: eliminated ? room.players.get(eliminated)?.name || "Player" : null,
    eliminatedRole: eliminated ? state.roles[eliminated] : null,
    tie: accused.length > 1,
    votes: Object.entries(state.vote).map(([playerId, targetId]) => ({
      playerId, name: room.players.get(playerId)?.name || "Player",
      targetId, targetName: room.players.get(targetId)?.name || "Player",
    })),
    lastNight: state.lastNight,
  };
  const winner = checkWin(room, state);
  if (winner) {
    state.voteResult.winner = winner;
    finish(room, state, winner);
    return;
  }
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const werewolf = {
  id: "werewolf",
  name: "Werewolf", description: "The village sleeps, the wolves hunt, and nobody trusts the morning.",
  emoji: "🐺", accent: "grape", tag: "Social",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
    room.state = {
      phase: "night", day: 0, roles: assignRoles(active),
      aliveIds: active.map((player) => player.id), inspections: {},
      nightKill: null, doctorSave: null, vote: {}, lastNight: null,
      voteResult: null, winner: null, done: false, endsAt: null,
    };
    beginNight(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (!state.aliveIds.includes(playerId)) throw failure("dead", "The dead cannot act");
    const role = state.roles[playerId];

    if (state.phase === "night") {
      if (event.type === "kill" && role === "werewolf") {
        const target = String(event.targetId || "");
        if (!state.aliveIds.includes(target) || state.roles[target] === "werewolf") {
          throw failure("invalid_target", "Choose a living villager");
        }
        state.nightKill = target;
        return;
      }
      if (event.type === "inspect" && role === "seer") {
        const target = String(event.targetId || "");
        if (!state.aliveIds.includes(target) || target === playerId) {
          throw failure("invalid_target", "Choose another living player");
        }
        const list = state.inspections[playerId] || [];
        if (list.some((entry) => entry.targetId === target)) throw failure("already_inspected", "You already checked them");
        list.push({ targetId: target, name: room.players.get(target)?.name || "Player", role: state.roles[target] });
        state.inspections[playerId] = list;
        return;
      }
      if (event.type === "protect" && role === "doctor") {
        const target = String(event.targetId || "");
        if (!state.aliveIds.includes(target)) throw failure("invalid_target", "Choose a living player");
        state.doctorSave = target;
      }
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (state.vote[playerId] !== undefined) throw failure("already_voted", "You already voted");
      const target = String(event.targetId || "");
      if (!state.aliveIds.includes(target) || target === playerId) {
        throw failure("invalid_target", "Vote for another living player");
      }
      state.vote[playerId] = target;
      if (state.aliveIds.every((id) => state.vote[id] !== undefined)) resolveVote(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "night") {
      resolveNight(room, state);
      return;
    }
    if (state.phase === "day") {
      state.phase = "vote";
      state.vote = {};
      state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
      return;
    }
    if (state.phase === "vote") {
      resolveVote(room, state);
      return;
    }
    if (state.phase === "reveal") {
      beginNight(room, state);
      return;
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    state.aliveIds = state.aliveIds.filter((id) => id !== playerId);
    delete state.vote[playerId];
    if (activePlayers(room).length < 5) {
      finish(room, state, checkWin(room, state) || "village");
      return "results";
    }
    const winner = checkWin(room, state);
    if (winner) {
      finish(room, state, winner);
      return "results";
    }
    if (state.phase === "vote" && state.aliveIds.every((id) => state.vote[id] !== undefined)) {
      resolveVote(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const role = state.roles[viewerId] || "villager";
    const alive = state.aliveIds.includes(viewerId);
    const base = {
      phase: state.phase, day: state.day, mode: room.mode, role, alive,
      youId: viewerId, isWolf: role === "werewolf", aliveIds: state.aliveIds,
      teammates: role === "werewolf"
        ? state.aliveIds.filter((id) => state.roles[id] === "werewolf").map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" }))
        : [],
      inspections: state.inspections[viewerId] || [],
      // Mirrors the picker back so the client can confirm a night choice.
      nightChoice:
        state.phase !== "night"
          ? null
          : role === "werewolf"
            ? state.nightKill
            : role === "doctor"
              ? state.doctorSave
              : null,
      lastNight: state.lastNight, voteResult: state.voteResult, winner: state.winner,
      hasVoted: state.vote[viewerId] !== undefined,
      submitted: Object.keys(state.vote).length, total: state.aliveIds.length,
      living: state.aliveIds.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
    };
    if (state.phase === "results" || state.done) {
      return {
        ...base,
        roles: Object.fromEntries(state.aliveIds.map((id) => [id, state.roles[id]])),
        allRoles: Object.entries(state.roles).map(([playerId, playerRole]) => ({
          playerId, name: room.players.get(playerId)?.name || "Player", role: playerRole,
        })),
      };
    }
    return base;
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase, day: state.day,
      aliveIds: state.aliveIds,
      living: state.aliveIds.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
      lastNight: state.lastNight,
      voteResult: state.voteResult,
      winner: state.winner,
      submitted: Object.keys(state.vote).length, total: state.aliveIds.length,
    };
  },
};

export default werewolf;
