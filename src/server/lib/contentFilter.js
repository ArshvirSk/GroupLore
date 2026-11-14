const BLOCKED = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "nigger",
  "faggot",
  "retard",
  "whore",
  "slut",
];

const SAFE_KEYS = new Set([
  "id",
  "type",
  "eventId",
  "playerId",
  "targetId",
  "targetPlayerId",
  "teamId",
  "choiceId",
  "optionId",
  "promptId",
  "cardId",
  "mode",
  "phase",
  "vote",
  "action",
]);

function words(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeContent(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsProfanity(value) {
  const list = words(value);
  return BLOCKED.some((word) =>
    list.some((candidate) => candidate === word || candidate === `${word}s`),
  );
}

/**
 * Scan only user-authored strings in an event payload. Identifiers and enum
 * fields are skipped so game routes and modes are never rejected by content.
 */
export function findProfanity(payload, key = "") {
  if (typeof payload === "string") {
    return SAFE_KEYS.has(key) ? null : containsProfanity(payload) ? payload : null;
  }
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const hit = findProfanity(item, key);
      if (hit) return hit;
    }
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  for (const [childKey, value] of Object.entries(payload)) {
    const hit = findProfanity(value, childKey);
    if (hit) return hit;
  }
  return null;
}

export const PROFANITY_WORDS = BLOCKED;
