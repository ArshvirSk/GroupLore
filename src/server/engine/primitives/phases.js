export function setPhase(state, phase, durationMs, extra = {}) {
  state.phase = phase;
  state.endsAt = Date.now() + Math.max(0, durationMs);
  Object.assign(state, extra);
  return state;
}

export function finish(state) {
  state.done = true;
  state.endsAt = null;
  return "results";
}

export function activePlayers(room) {
  return [...room.players.values()].filter((player) => player.connected);
}

export function everyoneSubmitted(room, submissions, exclude = []) {
  const players = activePlayers(room).filter(
    (player) => !exclude.includes(player.id),
  );
  return (
    players.length > 0 &&
    players.every((player) => submissions[player.id] !== undefined)
  );
}

export function everyoneVoted(room, votes, exclude = []) {
  return everyoneSubmitted(room, votes, exclude);
}
