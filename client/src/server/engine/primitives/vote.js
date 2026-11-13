export function tally(votes) {
  const counts = new Map();
  for (const target of Object.values(votes)) {
    counts.set(target, (counts.get(target) || 0) + 1);
  }
  return counts;
}

export function topTargets(counts) {
  let max = 0;
  for (const count of counts.values()) max = Math.max(max, count);
  if (max === 0) return [];
  return [...counts.entries()]
    .filter(([, count]) => count === max)
    .map(([target]) => target);
}

export function allVoted(players, votes) {
  const active = players.filter((player) => player.connected);
  return (
    active.length > 0 && active.every((player) => votes[player.id] !== undefined)
  );
}

export function publicTally(room, counts) {
  return [...counts.entries()]
    .map(([playerId, count]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function votesByVoter(room, votes) {
  return Object.entries(votes).map(([voterId, targetId]) => ({
    voterId,
    voterName: room.players.get(voterId)?.name || "Player",
    targetId,
    targetName: room.players.get(targetId)?.name || "Player",
  }));
}
