export function award(room, playerId, points) {
  if (!room.players.has(playerId)) return 0;
  const current = Number(room.scores[playerId] || 0);
  room.scores[playerId] = current + Number(points || 0);
  return room.scores[playerId];
}

export function awardMany(room, playerIds, points) {
  for (const playerId of playerIds) award(room, playerId, points);
}

export function ranking(room) {
  return [...room.players.values()]
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      score: Number(room.scores[player.id] || 0),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function winners(room) {
  const table = ranking(room);
  if (table.length === 0) return [];
  return table
    .filter((entry) => entry.score === table[0].score)
    .map((entry) => entry.playerId);
}
