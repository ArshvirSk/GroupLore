export function turnOrder(players) {
  return [...players]
    .filter((player) => player.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((player) => player.id);
}

export function nextTurn(order, currentId) {
  if (order.length === 0) return null;
  const index = order.indexOf(currentId);
  return order[(index + 1 + order.length) % order.length];
}

export function seatAfter(order, currentId, seats = 1) {
  if (order.length === 0) return null;
  const index = Math.max(0, order.indexOf(currentId));
  return order[(index + seats) % order.length];
}

export function currentTurnPlayer(room, playerId) {
  if (!playerId) return null;
  return room.players.get(playerId) || null;
}
