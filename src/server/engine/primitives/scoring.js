export function award(room, playerId, amount) {
  const points = Number(amount || 0);
  if (!room.players.has(playerId) || !points) return 0;
  room.scores[playerId] = Number(room.scores[playerId] || 0) + points;
  return room.scores[playerId];
}

export function awardMany(room, playerIds, amount) {
  for (const playerId of playerIds) award(room, playerId, amount);
}

export function pointsMap(room, entries) {
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([playerId]) => room.players.has(playerId))
      .map(([playerId, points]) => [playerId, Number(points || 0)]),
  );
}

export function roundPoints(room, points) {
  return Object.entries(points)
    .filter(([playerId, amount]) => room.players.has(playerId) && amount)
    .map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: Number(amount),
    }));
}
