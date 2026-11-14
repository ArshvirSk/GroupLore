import { shuffle } from "../utils/helpers.js";

export const TEAM_COLORS = ["#3D5AFE", "#FF5C8A", "#00A896", "#FF8A00"];
export const TEAM_NAMES = ["Blue", "Pink", "Teal", "Orange"];

export function autoBalance(playerIds, count, { keep = [], rng = Math.random } = {}) {
  const teamCount = Math.max(1, Number(count) || 2);
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: TEAM_NAMES[index % TEAM_NAMES.length],
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    playerIds: [],
  }));

  const ids = [...new Set(playerIds.filter(Boolean))];
  for (const team of keep) {
    for (const playerId of team.playerIds || []) {
      if (ids.includes(playerId)) teams[team.index].playerIds.push(playerId);
    }
  }

  const assigned = new Set(teams.flatMap((team) => team.playerIds));
  const remaining = shuffle(ids.filter((id) => !assigned.has(id)), rng);
  for (const playerId of remaining) {
    const target = [...teams].sort(
      (a, b) => a.playerIds.length - b.playerIds.length,
    )[0];
    target.playerIds.push(playerId);
  }
  return teams;
}

export function teamOf(room, playerId) {
  return (room.teams || []).find((team) => team.playerIds.includes(playerId)) || null;
}

export function teammates(room, playerId) {
  const team = teamOf(room, playerId);
  if (!team) return [];
  return team.playerIds
    .filter((id) => id !== playerId)
    .map((id) => room.players.get(id))
    .filter(Boolean);
}

export function removeFromTeams(room, playerId) {
  for (const team of room.teams || []) {
    team.playerIds = team.playerIds.filter((id) => id !== playerId);
  }
}

export function syncTeams(room, playerIds) {
  if (!room.teams?.length) return room.teams;
  removeFromTeams(room, null);
  const valid = new Set(playerIds);
  for (const team of room.teams) {
    team.playerIds = team.playerIds.filter((id) => valid.has(id));
  }
  const assigned = new Set(room.teams.flatMap((team) => team.playerIds));
  for (const playerId of playerIds) {
    if (assigned.has(playerId)) continue;
    const target = [...room.teams].sort(
      (a, b) => a.playerIds.length - b.playerIds.length,
    )[0];
    target.playerIds.push(playerId);
    assigned.add(playerId);
  }
  return room.teams;
}

export function rotateTeam(room) {
  if (!room.teams?.length) return null;
  const largest = [...room.teams].sort(
    (a, b) => b.playerIds.length - a.playerIds.length,
  )[0];
  const smallest = [...room.teams].sort(
    (a, b) => a.playerIds.length - b.playerIds.length,
  )[0];
  if (!largest || !smallest || largest.id === smallest.id) return null;
  const playerId = largest.playerIds.pop();
  if (playerId) smallest.playerIds.push(playerId);
  return playerId || null;
}

export function teamScores(room, points = {}) {
  const result = Object.fromEntries(
    (room.teams || []).map((team) => [team.id, 0]),
  );
  for (const team of room.teams || []) {
    for (const playerId of team.playerIds) {
      const value = Array.isArray(points)
        ? points.find((entry) => entry.playerId === playerId)?.points || 0
        : Number(points[playerId] || 0);
      result[team.id] += value;
    }
  }
  return result;
}

export function validateTeams(room, config = {}) {
  const teams = room.teams || [];
  const count = Number(config.count || 2);
  if (teams.length !== count) {
    return { ok: false, message: `This game needs ${count} teams` };
  }
  const assigned = teams.flatMap((team) => team.playerIds);
  const playerIds = [...room.players.keys()];
  if (assigned.length !== new Set(assigned).size) {
    return { ok: false, message: "A player is on more than one team" };
  }
  if (playerIds.some((id) => !assigned.includes(id))) {
    return { ok: false, message: "Every player must be assigned to a team" };
  }
  const min = Number(config.minPerTeam || 1);
  if (teams.some((team) => team.playerIds.length < min)) {
    return { ok: false, message: `Every team needs at least ${min} players` };
  }
  const sizes = teams.map((team) => team.playerIds.length);
  if (!config.allowUneven && Math.max(...sizes) - Math.min(...sizes) > 1) {
    return { ok: false, message: "Team sizes must differ by at most one" };
  }
  return { ok: true, message: "" };
}

export function teamsView(room) {
  return {
    teams: (room.teams || []).map((team) => ({
      id: team.id,
      name: team.name,
      color: team.color,
      playerIds: [...team.playerIds],
      score: team.playerIds.reduce(
        (total, playerId) => total + Number(room.scores?.[playerId] || 0),
        0,
      ),
    })),
    teamsLocked: Boolean(room.teamsLocked),
  };
}
