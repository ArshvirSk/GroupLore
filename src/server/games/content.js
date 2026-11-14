import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const PROMPT_BANK_RATINGS = require("../data/promptRatings.json");

const RATINGS = new Set(["family", "teen", "mature"]);
const RATING_RANK = { family: 0, teen: 1, mature: 2 };
const BANK_BY_GAME = new Map();

for (const [bank, meta] of Object.entries(PROMPT_BANK_RATINGS)) {
  for (const gameId of meta.gameIds) BANK_BY_GAME.set(gameId, bank);
}

export function contentForGame(gameId) {
  const bank = BANK_BY_GAME.get(gameId) || null;
  const meta = bank ? PROMPT_BANK_RATINGS[bank] : null;
  return {
    bank,
    rating: meta?.rating || "family",
    nsfw: Boolean(meta?.nsfw),
  };
}

export function maxContentRating(env = process.env) {
  const value = String(env.MAX_CONTENT_RATING || "mature").toLowerCase();
  return validContentRating(value) ? value : "mature";
}

export function contentAllowed(meta, env = process.env) {
  if (meta?.nsfw && env.ALLOW_NSFW_CONTENT !== "true") return false;
  const rating = validContentRating(meta?.rating) ? meta.rating : "family";
  return RATING_RANK[rating] <= RATING_RANK[maxContentRating(env)];
}

export function validContentRating(rating) {
  return RATINGS.has(rating);
}
