import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: { label: "Classic", description: "Five missions, hidden spies, tense votes", teamMs: 45_000, voteMs: 35_000, missionMs: 30_000, revealMs: 9_000 },
  quick: { label: "Quick", description: "Faster phases for a quicker coup", teamMs: 30_000, voteMs: 22_000, missionMs: 20_000, revealMs: 7_000 },
};

const TEAM_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 5, 5, 5],
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
  const spyCount = active.length >= 7 ? 3 : 2;
  const roles = Array.from({ length: active.length }, (_, index) => (index < spyCount ? "spy" : "resistance"));
  const shuffled = shuffle(roles);
  return Object.fromEntries(active.map((player, index) => [player.id, shuffled[index]]));
}

function teamSizeFor(state) {
  return TEAM_SIZES[Math.min(10, Math.max(5, state.order.length))]?.[state.mission - 1] || 3;
}

function beginTeam(room, state) {
  state.phase = "team";
  state.team = [];
  state.votes = {};
  state.missionVotes = {};
  state.leaderId = state.order[state.leaderIndex % state.order.length];
  state.endsAt = Date.now() + configFor(MODES, room.mode).teamMs;
}

function finish(room, state, winner) {
  state.winner = winner;
  state.done = true;
  state.phase = "results";
  state.endsAt = null;
  for (const playerId of state.order) {
    if (state.roles[playerId] === winner) {
      room.scores[playerId] = Number(room.scores[playerId] || 0) + 500;
    }
  }
}

function beginVote(room, state) {
  state.phase = "vote";
  state.votes = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
}

function resolveVote(room, state) {
  const approvals = Object.values(state.votes).filter((value) => value === "approve").length;
  const rejections = Object.values(state.votes).filter((value) => value === "reject").length;
  const approved = approvals > rejections;
  state.voteResult = {
    approved, approvals, rejections,
    votes: Object.entries(state.votes).map(([playerId, value]) => ({
      playerId, name: room.players.get(playerId)?.name || "Player", value,
    })),
    team: state.team.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
    required: teamSizeFor(state),
    rejects: state.rejectCount + (approved ? 0 : 1),
  };
  if (!approved) {
    state.rejectCount += 1;
    if (state.rejectCount >= 5) {
      finish(room, state, "spy");
      return;
    }
    state.leaderIndex += 1;
    beginTeam(room, state);
    return;
  }
  state.phase = "mission";
  state.missionVotes = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).missionMs;
}

function resolveMission(room, state) {
  const fails = state.team.filter((id) => state.missionVotes[id] === "fail").length;
  const success = fails === 0;
  state.missionResults.push(success);
  state.lastMission = {
    success, fails, round: state.mission,
    team: state.team.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
    vote: state.voteResult,
  };
  const successes = state.missionResults.filter(Boolean).length;
  const failures = state.missionResults.length - successes;
  if (successes >= 3) {
    state.lastMission.winner = "resistance";
    finish(room, state, "resistance");
    return;
  }
  if (failures >= 3) {
    state.lastMission.winner = "spy";
    finish(room, state, "spy");
    return;
  }
  if (state.mission >= 5) {
    const winner = successes > failures ? "resistance" : "spy";
    state.lastMission.winner = winner;
    finish(room, state, winner);
    return;
  }
  state.mission += 1;
  state.leaderIndex += 1;
  state.rejectCount = 0;
  state.votes = {};
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const resistance = {
  id: "resistance",
  name: "Resistance", description: "Complete missions while spies hidden in the group sabotage them.",
  emoji: "🕶️", accent: "blue", tag: "Social",
  minPlayers: 2, maxPlayers: 10, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
    room.state = {
      phase: "team", mission: 1, leaderIndex: 0, leaderId: null,
      roles: assignRoles(active), order: active.map((player) => player.id),
      team: [], votes: {}, missionVotes: {}, rejectCount: 0,
      missionResults: [], voteResult: null, lastMission: null,
      winner: null, done: false, endsAt: null,
    };
    beginTeam(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (!state.order.includes(playerId)) throw failure("not_playing", "You are not in this game");

    if (state.phase === "team" && event.type === "team") {
      if (playerId !== state.leaderId) throw failure("leader_only", "Only the leader picks the team");
      const picked = Array.isArray(event.playerIds) ? [...new Set(event.playerIds.map(String))] : [];
      const required = teamSizeFor(state);
      if (picked.length !== required) throw failure("wrong_team_size", `Pick exactly ${required} players`);
      if (picked.some((id) => !state.order.includes(id))) throw failure("invalid_team", "Pick players in the game");
      state.team = picked;
      beginVote(room, state);
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (state.votes[playerId] !== undefined) throw failure("already_voted", "You already voted");
      const value = event.value;
      if (!["approve", "reject"].includes(value)) throw failure("invalid_vote", "Approve or reject");
      state.votes[playerId] = value;
      if (state.order.every((id) => state.votes[id] !== undefined)) resolveVote(room, state);
      return;
    }

    if (state.phase === "mission" && event.type === "mission") {
      if (!state.team.includes(playerId)) throw failure("not_on_team", "Only team members act on the mission");
      if (state.missionVotes[playerId] !== undefined) throw failure("already_acted", "You already chose");
      if (state.roles[playerId] === "resistance" && event.value === "fail") {
        throw failure("resistance_cannot_fail", "Resistance members must succeed");
      }
      if (!["success", "fail"].includes(event.value)) throw failure("invalid_choice", "Choose success or fail");
      state.missionVotes[playerId] = event.value;
      if (state.team.every((id) => state.missionVotes[id] !== undefined)) resolveMission(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "team") {
      const required = teamSizeFor(state);
      state.team = shuffle(state.order).slice(0, required);
      beginVote(room, state);
      return;
    }
    if (state.phase === "vote") {
      for (const id of state.order) {
        if (state.votes[id] === undefined) state.votes[id] = "reject";
      }
      resolveVote(room, state);
      return;
    }
    if (state.phase === "mission") {
      for (const id of state.team) {
        if (state.missionVotes[id] === undefined) state.missionVotes[id] = "success";
      }
      resolveMission(room, state);
      return;
    }
    if (state.phase === "reveal") {
      beginTeam(room, state);
      return;
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    state.order = state.order.filter((id) => id !== playerId);
    state.team = state.team.filter((id) => id !== playerId);
    delete state.votes[playerId];
    delete state.missionVotes[playerId];
    delete state.roles[playerId];
    if (activePlayers(room).length < 5) {
      finish(room, state, "spy");
      return "results";
    }
    if (playerId === state.leaderId && state.phase === "team") {
      beginTeam(room, state);
    } else if (state.phase === "vote" && state.order.every((id) => state.votes[id] !== undefined)) {
      resolveVote(room, state);
    } else if (state.phase === "mission" && state.team.every((id) => state.missionVotes[id] !== undefined)) {
      resolveMission(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const role = state.roles[viewerId] || "resistance";
    const spies = state.order.filter((id) => state.roles[id] === "spy");
    const base = {
      phase: state.phase, mode: room.mode, mission: state.mission, missions: 5,
      role, isSpy: role === "spy",
      spyTeam: role === "spy" ? spies.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })) : [],
      leaderId: state.leaderId, leaderName: room.players.get(state.leaderId)?.name || "Player",
      isLeader: viewerId === state.leaderId,
      required: teamSizeFor(state), team: state.team,
      squad: state.team.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
      players: state.order.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
      rejectCount: state.rejectCount,
      hasVoted: state.votes[viewerId] !== undefined,
      voteCount: Object.keys(state.votes).length,
      isOnTeam: state.team.includes(viewerId),
      hasActed: state.missionVotes[viewerId] !== undefined,
      missionCount: Object.keys(state.missionVotes).length,
      missionResults: state.missionResults,
      lastMission: state.lastMission, winner: state.winner,
      spyCount: spies.length,
    };
    if (state.phase === "results" || state.done) {
      return {
        ...base,
        allRoles: state.order.map((id) => ({
          playerId: id, name: room.players.get(id)?.name || "Player", role: state.roles[id],
        })),
      };
    }
    return base;
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase, mission: state.mission, missions: 5,
      leaderName: room.players.get(state.leaderId)?.name || "Player",
      required: teamSizeFor(state),
      squad: state.team.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player" })),
      rejectCount: state.rejectCount,
      voteCount: Object.keys(state.votes).length,
      missionCount: Object.keys(state.missionVotes).length,
      missionResults: state.missionResults,
      lastMission: state.lastMission, winner: state.winner,
    };
  },
};

export default resistance;
