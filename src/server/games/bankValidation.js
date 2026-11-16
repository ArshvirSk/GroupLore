const TEXT_FIELDS = [
  "text",
  "prompt",
  "question",
  "scenario",
  "template",
  "word",
  "starter",
  "item",
  "category",
];

function textOf(item) {
  for (const field of TEXT_FIELDS) {
    if (typeof item?.[field] === "string") return item[field].trim();
  }
  if (typeof item?.a === "string" && typeof item?.b === "string") {
    return `${item.a} / ${item.b}`.trim();
  }
  if (typeof item?.low === "string" && typeof item?.high === "string") {
    return `${item.low} / ${item.high}`.trim();
  }
  if (Array.isArray(item?.categories)) {
    return item.categories.map(String).join(" / ").trim();
  }
  return "";
}

function tokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  const left = new Set(a);
  const right = new Set(b);
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

const TRIVIA_FAMILY_LIMITS = {
  "buzzer-trivia": 0.08,
  "fact-or-fiction": 0.08,
  flag: 0.12,
  "emoji-decode": 0.12,
};

function firstStem(text) {
  return tokens(text).slice(0, 4).join(" ");
}

function templateFamily(text) {
  const value = text.toLowerCase();
  if (/\bcapital\b/.test(value)) return "capital";
  if (/\bchemical symbol\b/.test(value)) return "chemical symbol";
  if (/\bwho (wrote|painted|composed|directed)\b/.test(value)) return "creator";
  if (/\b(what|which|in which) year\b|\byear of\b|\bwhen (was|did)\b/.test(value)) {
    return "year";
  }
  if (/\bhow many\b/.test(value)) return "count";
  if (/\b(largest|smallest|longest|shortest|tallest|highest|lowest)\b/.test(value)) {
    return "superlative";
  }
  if (/\bcurrency\b/.test(value)) return "currency";
  if (/\bwhich planet\b|\bwhat planet\b/.test(value)) return "planet";
  if (/\bwhich country\b|\bwhat country\b/.test(value)) return "country";
  if (/\bwho (is|was)\b/.test(value)) return "person";
  if (/\bwhich (element|metal|gas)\b|\bwhat element\b/.test(value)) return "element";
  return null;
}

function topEntries(map, limit = 10) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export function patternReport(gameId, items = []) {
  const stems = new Map();
  const families = new Map();
  const total = items.length || 1;
  for (const item of items) {
    const text = textOf(item);
    if (!text) continue;
    const stem = firstStem(text);
    if (stem) stems.set(stem, (stems.get(stem) || 0) + 1);
    const family = templateFamily(text);
    if (family) families.set(family, (families.get(family) || 0) + 1);
  }
  const stemLimit = Math.max(1, Math.ceil(total * 0.03));
  const stemFailures = [...stems.entries()]
    .filter(([, count]) => count > stemLimit)
    .sort((a, b) => b[1] - a[1]);
  const familyLimit = TRIVIA_FAMILY_LIMITS[gameId];
  const familyFailures = familyLimit
    ? [...families.entries()]
        .filter(([, count]) => count > total * familyLimit)
        .sort((a, b) => b[1] - a[1])
    : [];
  return {
    total: items.length,
    stems: topEntries(stems),
    families: topEntries(families),
    stemFailures,
    familyFailures,
    familyLimit,
  };
}

function connectionErrors(item) {
  const errors = [];
  if (!Array.isArray(item?.groups) || item.groups.length !== 4) {
    errors.push(`${item?.id || "connections"}: needs four groups`);
    return errors;
  }
  const words = [];
  for (const group of item.groups) {
    if (!Array.isArray(group?.words) || group.words.length !== 4) {
      errors.push(`${item?.id || "connections"}: every group needs four words`);
      continue;
    }
    if (group.words.some((word) => !String(word || "").trim())) {
      errors.push(`${item?.id || "connections"}: blank word`);
    }
    words.push(...group.words.map((word) => String(word).trim().toLowerCase()));
  }
  if (words.length !== 16) errors.push(`${item?.id || "connections"}: needs 16 words`);
  if (new Set(words).size !== words.length) {
    errors.push(`${item?.id || "connections"}: a word appears twice`);
  }
  return errors;
}

/**
 * @param {{gameId?: string, items?: Record<string, unknown>[], target?: number, skipNearDuplicates?: boolean}} [options]
 */
export function validateBank({
  gameId,
  items = [],
  target = 0,
  skipNearDuplicates = false,
} = {}) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const texts = new Set();
  const normalized = [];
  const counts = { difficulty: new Map(), tags: 0, rating: 0 };

  if (items.length < target) {
    errors.push(`${gameId}: ${items.length}/${target} items (bank below target)`);
  }

  for (const [index, item] of items.entries()) {
    const id = String(item?.id ?? "").trim();
    if (!id) errors.push(`${gameId}[${index}]: missing id`);
    else if (ids.has(id)) errors.push(`${gameId}: duplicate id ${id}`);
    ids.add(id);

    if (gameId === "connections") {
      errors.push(...connectionErrors(item));
      if (Array.isArray(item?.tags) && item.tags.length) counts.tags += 1;
      if (["all", "spicy", "family", "teen", "mature"].includes(item?.rating)) {
        counts.rating += 1;
      }
      continue;
    }

    const text = textOf(item);
    if (!text) errors.push(`${gameId}:${id || index} has no text`);
    const textLimit = gameId === "mad-libs" ? 700 : 320;
    if (text.length > textLimit) {
      errors.push(
        `${gameId}:${id || index} text exceeds ${textLimit} characters`,
      );
    }
    const key = text.toLowerCase();
    if (key && texts.has(key)) errors.push(`${gameId}:${id || index} duplicates text`);
    texts.add(key);
    if (key && !skipNearDuplicates) normalized.push({ id, tokens: tokens(text) });

    if (item?.difficulty !== undefined) {
      const value = Number(item.difficulty);
      if (![1, 2, 3].includes(value)) {
        errors.push(`${gameId}:${id || index} difficulty must be 1-3`);
      } else {
        counts.difficulty.set(value, (counts.difficulty.get(value) || 0) + 1);
      }
    }
    if (item?.tags !== undefined) {
      if (!Array.isArray(item.tags) || !item.tags.length) {
        errors.push(`${gameId}:${id || index} tags must be a non-empty array`);
      } else {
        counts.tags += 1;
      }
    }
    if (item?.rating !== undefined) {
      const legacyRatings = ["family", "teen", "mature"];
      if (!["all", "spicy", ...legacyRatings].includes(item.rating)) {
        errors.push(
          `${gameId}:${id || index} rating must be all, spicy, or a legacy family/teen/mature value`,
        );
      } else {
        counts.rating += 1;
      }
    }
  }

  const patterns = patternReport(gameId, items);
  for (const [stem, count] of patterns.stemFailures) {
    errors.push(
      `${gameId}: stem "${stem}" is ${count}/${items.length} items (over 3%)`,
    );
  }
  for (const [family, count] of patterns.familyFailures) {
    errors.push(
      `${gameId}: template family "${family}" is ${count}/${items.length} items (over ${Math.round((patterns.familyLimit || 0) * 100)}%)`,
    );
  }

  if (!skipNearDuplicates) {
    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        if (jaccard(normalized[i].tokens, normalized[j].tokens) > 0.85) {
          errors.push(
            `${gameId}: near duplicate ${normalized[i].id} / ${normalized[j].id}`,
          );
        }
      }
    }
  }

  if (gameId === "fact-or-fiction") {
    const trueCount = items.filter((item) => item.isTrue === true).length;
    const ratio = items.length ? trueCount / items.length : 0;
    if (items.length >= 20 && (ratio < 0.35 || ratio > 0.65)) {
      errors.push(`${gameId}: true/false split is ${Math.round(ratio * 100)}% true`);
    }
  }

  if (counts.tags < items.length) {
    warnings.push(
      `${gameId}: ${items.length - counts.tags} items have no tags`,
    );
  }
  if (counts.rating < items.length) {
    warnings.push(
      `${gameId}: ${items.length - counts.rating} items have no rating`,
    );
  }

  return {
    gameId,
    count: items.length,
    target,
    errors,
    warnings,
    patterns,
  };
}
