import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import {
  PROMPT_BANK_RATINGS,
  contentAllowed,
  contentForGame,
  validContentRating,
} from "../games/content.js";
import { listGames } from "../games/index.js";

test("every prompt bank has content metadata", () => {
  const banks = readdirSync(new URL("../data/prompts/", import.meta.url))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();

  assert.deepEqual(Object.keys(PROMPT_BANK_RATINGS).sort(), banks);

  for (const [bank, meta] of Object.entries(PROMPT_BANK_RATINGS)) {
    assert.equal(validContentRating(meta.rating), true, `${bank} rating`);
    assert.equal(typeof meta.nsfw, "boolean", `${bank} nsfw flag`);
    assert.ok(
      Array.isArray(meta.gameIds) && meta.gameIds.length > 0,
      `${bank} must map to at least one game`,
    );
  }
});

test("every public game resolves to a valid content rating", () => {
  const games = listGames();
  assert.ok(games.length > 0);

  for (const game of games) {
    const content = contentForGame(game.id);
    assert.equal(validContentRating(content.rating), true, game.id);
    assert.equal(typeof content.nsfw, "boolean", game.id);
  }
});

test("nsfw banks are excluded unless explicitly enabled", () => {
  const nsfw = { rating: "mature", nsfw: true };
  const family = { rating: "family", nsfw: false };

  assert.equal(contentAllowed(nsfw, {}), false);
  assert.equal(contentAllowed(nsfw, { ALLOW_NSFW_CONTENT: "true" }), true);
  assert.equal(contentAllowed(family, {}), true);
  assert.equal(contentAllowed({ rating: "teen", nsfw: false }, { MAX_CONTENT_RATING: "family" }), false);
  assert.equal(contentAllowed({ rating: "teen", nsfw: false }, { MAX_CONTENT_RATING: "teen" }), true);
});
