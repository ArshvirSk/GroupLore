/**
 * Text answer helpers shared by matching games (Hive Mind / Odd One Out).
 * Kept dependency-free so the engine can run without any extra services.
 */
const SYNONYMS = new Map([
  ["tv", "television"],
  ["phone", "mobile"],
  ["cell", "mobile"],
  ["movie", "film"],
  ["fridge", "refrigerator"],
  ["couch", "sofa"],
  ["mom", "mother"],
  ["dad", "father"],
  ["pizza", "pizza"],
  ["bike", "bicycle"],
]);

export function normalizeText(value) {
  let text = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\u2019']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  if (SYNONYMS.has(text)) text = SYNONYMS.get(text);

  return text
    .split(" ")
    .map((word) => {
      if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
      if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
      if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(" ");
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

export function answersMatch(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length > 4 && right.length > 4) {
    return levenshtein(left, right) <= 1;
  }
  return false;
}

export function groupAnswers(entries) {
  const groups = [];
  for (const entry of entries) {
    const existing = groups.find((group) =>
      answersMatch(group.answer, entry.answer),
    );
    if (existing) existing.entries.push(entry);
    else groups.push({ answer: entry.answer, entries: [entry] });
  }
  return groups.sort((a, b) => b.entries.length - a.entries.length);
}

export function allSubmitted(players, submissions) {
  const active = players.filter((player) => player.connected);
  return (
    active.length > 0 &&
    active.every((player) => submissions[player.id] !== undefined)
  );
}
