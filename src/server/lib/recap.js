import { containsProfanity, normalizeContent } from "./contentFilter.js";

export function recapShareId(sessionId, at = Date.now()) {
  const base = String(sessionId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 12);
  return `${base}-${Number(at).toString(36)}`;
}

function collectMoments(value, key = "", output = []) {
  if (typeof value === "string") {
    if (["text", "answer", "caption", "word", "pitch", "clue", "value"].includes(key)) {
      const text = normalizeContent(value).slice(0, 240);
      if (text.length >= 8 && !containsProfanity(text)) output.push(text);
    }
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMoments(item, key, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [childKey, child] of Object.entries(value)) {
    collectMoments(child, childKey, output);
  }
  return output;
}

export function buildRecap({ room, gameId, mode, ranking, reason }) {
  const winnerEntries = ranking.filter(
    (entry) => entry.score === ranking[0]?.score && entry.score > 0,
  );
  const winnerNames = winnerEntries.map((entry) => entry.name);
  const winnerName = winnerNames.length ? winnerNames.join(" & ") : "Nobody";
  const highlights = [];

  if (ranking[0]) {
    highlights.push(
      winnerNames.length
        ? `${winnerName} won with ${ranking[0].score} points`
        : "Everyone finished level — no winner this time",
    );
  }

  let publicView = null;
  try {
    publicView = room?.module?.publicFor?.(room) || null;
  } catch {
    publicView = null;
  }
  if (publicView) {
    const moments = [...new Set(collectMoments(publicView))].slice(0, 3);
    highlights.push(...moments);
  }

  return {
    shareId: recapShareId(room?.id),
    gameType: gameId,
    mode: mode || null,
    winnerName: winnerEntries.length ? winnerName : null,
    winnerNames,
    highlights,
    scores: ranking.map((entry) => ({
      name: entry.name,
      score: entry.score,
      winner: winnerEntries.some((winner) => winner.playerId === entry.playerId),
    })),
    reason,
  };
}
