import assert from "node:assert/strict";
import { test } from "node:test";
import { patternReport, validateBank } from "../games/bankValidation.js";

test("a valid bank passes its target", () => {
  const result = validateBank({
    gameId: "demo",
    target: 2,
    items: [
      { id: "demo-1", text: "A clean prompt", tags: ["school"], rating: "all", difficulty: 1 },
      { id: "demo-2", text: "A different prompt about food", tags: ["food"], rating: "all", difficulty: 2 },
    ],
  });
  assert.deepEqual(result.errors, []);
});

test("repeated first-four-word stems fail the diversity check", () => {
  const items = Array.from({ length: 40 }, (_, index) => ({
    id: `stem-${index}`,
    text: `The worst thing to bring number ${index}`,
    tags: ["comedy"],
    rating: "all",
    difficulty: 1,
  }));
  const report = patternReport("roast-battle", items);
  assert.equal(report.stemFailures[0][0], "the worst thing to");
  const result = validateBank({ gameId: "roast-battle", target: 40, items });
  assert.equal(result.errors.some((error) => error.includes("stem")), true);
});

test("trivia template families have an 8% cap", () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    id: `trivia-${index}`,
    text: `What is the capital of Place ${index}?`,
    answer: `City ${index}`,
    tags: ["trivia"],
    rating: "all",
    difficulty: 1,
  }));
  const report = patternReport("buzzer-trivia", items);
  assert.equal(report.familyFailures[0][0], "capital");
});

test("duplicate ids, blank text and short banks fail", () => {
  const result = validateBank({
    gameId: "demo",
    target: 3,
    items: [
      { id: "demo-1", text: "Same prompt" },
      { id: "demo-1", text: "  " },
    ],
  });
  assert.equal(result.errors.some((error) => error.includes("below target")), true);
  assert.equal(result.errors.some((error) => error.includes("duplicate id")), true);
  assert.equal(result.errors.some((error) => error.includes("no text")), true);
});

test("near duplicates and bad difficulty are rejected", () => {
  const result = validateBank({
    gameId: "demo",
    target: 2,
    items: [
      { id: "demo-1", text: "The quick brown fox jumps over the lazy dog", difficulty: 4 },
      { id: "demo-2", text: "The quick brown fox jumps over a lazy dog", difficulty: 1 },
    ],
  });
  assert.equal(result.errors.some((error) => error.includes("near duplicate")), true);
  assert.equal(result.errors.some((error) => error.includes("difficulty")), true);
});

test("connections require sixteen unique words in four groups", () => {
  const valid = {
    id: "conn-1",
    groups: [
      { words: ["a", "b", "c", "d"] },
      { words: ["e", "f", "g", "h"] },
      { words: ["i", "j", "k", "l"] },
      { words: ["m", "n", "o", "p"] },
    ],
  };
  assert.deepEqual(
    validateBank({ gameId: "connections", target: 1, items: [valid] }).errors,
    [],
  );
  const invalid = {
    id: "conn-2",
    groups: [
      { words: ["a", "b", "c", "d"] },
      { words: ["a", "f", "g", "h"] },
      { words: ["i", "j", "k", "l"] },
      { words: ["m", "n", "o"] },
    ],
  };
  const result = validateBank({ gameId: "connections", target: 1, items: [invalid] });
  assert.equal(result.errors.some((error) => error.includes("four words")), true);
  assert.equal(result.errors.some((error) => error.includes("appears twice")), true);
});
