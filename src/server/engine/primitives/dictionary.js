import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WORDS = require("../../data/boggleWords.json");
const WORD_SET = new Set(WORDS);

export function isWord(value) {
  return WORD_SET.has(String(value || "").toLowerCase());
}

export function words() {
  return WORDS;
}

export const WORD_LIST = WORDS;
