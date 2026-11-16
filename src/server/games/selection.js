import { seededShuffle } from "./cards.js";

function difficultyOf(item) {
  const value = Number(item?.difficulty);
  return Number.isFinite(value) ? value : null;
}

function tagsOf(item) {
  if (Array.isArray(item?.tags)) return item.tags.map(String);
  if (typeof item?.tag === "string") return [item.tag];
  if (typeof item?.category === "string") return [item.category];
  return [];
}

export function normalizeFilters(filters = {}) {
  const min = Number(filters.difficultyMin ?? 1);
  const max = Number(filters.difficultyMax ?? 3);
  return {
    difficultyMin: Math.min(Math.max(1, min || 1), 3),
    difficultyMax: Math.min(Math.max(1, max || 3), 3),
    tags: Array.isArray(filters.tags) ? filters.tags.map(String) : [],
    allowSpicy: Boolean(filters.allowSpicy),
  };
}

/**
 * Choose bank items without repeating one inside a pick.
 *
 * `seen` is a map of item id -> last seen timestamp (or monotonically
 * increasing order). Unseen items come first; once the bank is exhausted the
 * least recently seen items are returned. Spicy items are excluded unless the
 * caller explicitly enables the Spicy pack.
 */
export function pickItems({
  items = [],
  count = 1,
  filters = {},
  seen = new Map(),
  seed = "content",
} = {}) {
  const config = normalizeFilters(filters);
  const eligible = items.filter((item) => {
    if (!item || item.id === undefined) return false;
    if (item.rating === "spicy" && !config.allowSpicy) return false;
    const difficulty = difficultyOf(item);
    if (
      difficulty !== null &&
      (difficulty < config.difficultyMin || difficulty > config.difficultyMax)
    ) {
      return false;
    }
    if (config.tags.length) {
      const tags = tagsOf(item);
      if (!tags.some((tag) => config.tags.includes(tag))) return false;
    }
    return true;
  });

  const ranked = seededShuffle(eligible, seed).sort((a, b) => {
    const aSeen = seen.get(a.id);
    const bSeen = seen.get(b.id);
    const aTime = aSeen === undefined ? -1 : Number(aSeen);
    const bTime = bSeen === undefined ? -1 : Number(bSeen);
    return aTime - bTime;
  });
  return ranked.slice(0, Math.max(0, Math.min(Number(count) || 0, ranked.length)));
}

export function recordSeen(seen, items, seenAt = Date.now()) {
  for (const item of items) {
    if (item?.id !== undefined) seen.set(item.id, seenAt);
  }
  return seen;
}

export function pruneSeen(seen, now = Date.now(), maxAgeMs = 180 * 24 * 60 * 60 * 1000) {
  for (const [id, at] of seen) {
    if (Number(at) < now - maxAgeMs) seen.delete(id);
  }
  return seen;
}
