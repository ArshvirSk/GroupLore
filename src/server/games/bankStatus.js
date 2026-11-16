import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const BANKS = {
  "acronym-wars": () => require("../data/prompts/acronymWars.json"),
  "avoid-the-answer": () => require("../data/prompts/avoidTheAnswer.json"),
  "blind-sketch": () => require("../data/prompts/blindSketch.json"),
  bluff: () => require("../data/prompts/bluff.json"),
  "buzzer-trivia": () => require("../data/prompts/buzzerTrivia.json"),
  "caption-this": () => require("../data/prompts/captionThis.json"),
  "category-rush": () => require("../data/prompts/categoryRush.json"),
  codenames: () => require("../data/prompts/codenames.json"),
  connections: () => require("../data/prompts/connections.json"),
  "fact-or-fiction": () => require("../data/prompts/factOrFiction.json"),
  "fill-the-blank": () => require("../data/prompts/fillTheBlank.json").prompts,
  "five-second": () => require("../data/prompts/fiveSecond.json"),
  "higher-or-lower": () => require("../data/prompts/higherLower.json"),
  "hive-mind": () => require("../data/prompts/hive.json"),
  "hot-takes": () => require("../data/prompts/hotTakes.json"),
  "guess-impostor": () => require("../data/prompts/impostor.json"),
  madlibs: () => require("../data/prompts/madLibs.json"),
  "most-likely-to": () => require("../data/prompts/mostLikelyTo.json"),
  "odd-one-out": () => require("../data/prompts/hive.json"),
  "overrated-underrated": () => require("../data/prompts/overrated.json"),
  password: () => require("../data/prompts/password.json"),
  "pitch-perfect": () => require("../data/prompts/pitchPerfect.json"),
  "roast-battle": () => require("../data/prompts/roastBattle.json"),
  scattergories: () => require("../data/prompts/scattergories.json"),
  "story-chain": () => require("../data/prompts/storyChain.json"),
  "survey-says": () => require("../data/prompts/surveySays.json"),
  "two-truths": () => require("../data/prompts/twoTruths.json"),
  wavelength: () => require("../data/prompts/wavelength.json"),
  "would-you-rather": () => require("../data/prompts/wouldYouRather.json"),
  "blur-guess": () => require("../data/assets/blur/manifest.json"),
};

// A bank is playable when it can fill one round without repeating an item.
const MINIMUM_ITEMS = 1;
const overrides = new Map();

function bankItems(gameId) {
  if (overrides.has(gameId)) return overrides.get(gameId);
  return BANKS[gameId]?.() || null;
}

export function bankStatus(gameId) {
  const items = bankItems(gameId);
  if (!items) return { required: false, size: null, minimum: 0, playable: true };
  const size = Array.isArray(items) ? items.length : 0;
  return {
    required: true,
    size,
    minimum: MINIMUM_ITEMS,
    playable: size >= MINIMUM_ITEMS,
  };
}

export function isGamePlayable(gameId) {
  return bankStatus(gameId).playable;
}

export function unavailableReason(gameId) {
  const status = bankStatus(gameId);
  if (status.playable) return "";
  return status.required ? "Coming soon: content is still being prepared" : "";
}

export function setBankOverrideForTests(gameId, items) {
  if (items === null) overrides.delete(gameId);
  else overrides.set(gameId, items);
}
