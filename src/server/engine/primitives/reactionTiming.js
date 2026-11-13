/**
 * Reaction scoring uses server timestamps only. Clients never report latency.
 */
export function reactionScore(round, playerId) {
  const submittedAt = round.submittedAt?.[playerId];
  if (!submittedAt) return null;
  return Math.max(0, submittedAt - round.startedAt);
}

export function rankReactions(round) {
  const times = Object.entries(round.submittedAt || {})
    .map(([playerId, at]) => ({
      playerId,
      ms: Math.max(0, at - round.startedAt),
      falseStart: Boolean(round.falseStarts?.[playerId]),
    }))
    .sort((a, b) => {
      if (a.falseStart !== b.falseStart) return a.falseStart ? 1 : -1;
      return a.ms - b.ms;
    });

  return times.map((entry, index) => ({
    ...entry,
    place: index + 1,
    points: entry.falseStart ? 0 : Math.max(10, 100 - index * 15),
  }));
}
