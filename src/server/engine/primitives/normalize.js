export {
  normalizeText,
  levenshtein,
  answersMatch,
  groupAnswers,
} from "./textSubmit.js";

export function normalizeWord(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .trim();
}

export function isNearMiss(guess, answer, maxDistance = 1) {
  const left = normalizeWord(guess);
  const right = normalizeWord(answer);
  if (!left || !right || left === right) return false;
  if (left.length < 5 || right.length < 5) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length] <= maxDistance;
}

export function tokenize(value) {
  return normalizeWord(value).split(/\s+/).filter(Boolean);
}
