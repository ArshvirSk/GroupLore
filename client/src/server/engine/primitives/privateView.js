export function hideVotes(votes) {
  return Object.fromEntries(Object.keys(votes).map((voterId) => [voterId, null]));
}

export function pick(view, keys) {
  return Object.fromEntries(keys.map((key) => [key, view?.[key]]));
}

export function maskNames(entries) {
  return entries.map(({ playerId, ...rest }) => ({ ...rest, playerId }));
}
