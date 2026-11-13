export function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export function activePlayers(room) {
  return [...room.players.values()].filter((player) => player.connected);
}

export function configFor(modes, mode) {
  return modes[mode] || modes.classic;
}

export function choosePrompt(bank, state) {
  if (state.usedPromptIds.length >= bank.length) state.usedPromptIds = [];
  let index = Math.floor(Math.random() * bank.length);
  let guard = 0;
  while (state.usedPromptIds.includes(bank[index].id) && guard < 500) {
    index = Math.floor(Math.random() * bank.length);
    guard += 1;
  }
  state.usedPromptIds.push(bank[index].id);
  return bank[index];
}

export function addPoints(room, points, playerId, amount) {
  if (!room.players.has(playerId) || !amount) return;
  points.set(playerId, (points.get(playerId) || 0) + amount);
}

export function commitPoints(room, points) {
  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }
}

export function pointsList(room, points) {
  return [...points.entries()]
    .filter(([playerId]) => room.players.has(playerId))
    .map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: amount,
    }));
}
