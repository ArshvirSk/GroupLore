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
      continue;
    }

    const text = textOf(item);
    if (!text) errors.push(`${gameId}:${id || index} has no text`);
    if (text.length > 320) {
      errors.push(`${gameId}:${id || index} text exceeds 320 characters`);
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
      if (!["all", "spicy"].includes(item.rating)) {
        errors.push(`${gameId}:${id || index} rating must be all or spicy`);
      } else {
        counts.rating += 1;
      }
    }
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

  if (counts.tags < items.length * 0.5) {
    warnings.push(
      `${gameId}: ${items.length - counts.tags} items have no tags`,
    );
  }
  if (counts.rating < items.length * 0.5) {
    warnings.push(
      `${gameId}: ${items.length - counts.rating} items have no rating`,
    );
  }

  return { gameId, count: items.length, target, errors, warnings };
}
