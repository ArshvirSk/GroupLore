import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeFilters,
  pickItems,
  pruneSeen,
  recordSeen,
} from "../games/selection.js";

const bank = Array.from({ length: 12 }, (_, index) => ({
  id: `item-${index}`,
  text: `Item ${index}`,
  difficulty: (index % 3) + 1,
  tags: index % 2 === 0 ? ["science"] : ["food"],
  rating: index === 11 ? "spicy" : "all",
}));

test("spicy items are hidden unless the pack is enabled", () => {
  const safe = pickItems({ items: bank, count: 12, seed: "safe" });
  assert.equal(safe.some((item) => item.rating === "spicy"), false);
  const spicy = pickItems({
    items: bank,
    count: 12,
    filters: { allowSpicy: true },
    seed: "safe",
  });
  assert.equal(spicy.some((item) => item.rating === "spicy"), true);
});

test("unseen items come first and a pick never repeats", () => {
  const seen = new Map(bank.slice(0, 8).map((item, index) => [item.id, index + 1]));
  const picked = pickItems({ items: bank, count: 3, seen, seed: "unseen" });
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((item) => item.id)).size, 3);
  assert.equal(picked.every((item) => item.id === "item-11" || !seen.has(item.id)), true);
});

test("filters honour difficulty and tags", () => {
  const config = normalizeFilters({ difficultyMin: 2, difficultyMax: 2, tags: ["food"] });
  assert.deepEqual(config, {
    difficultyMin: 2,
    difficultyMax: 2,
    tags: ["food"],
    allowSpicy: false,
  });
  const picked = pickItems({
    items: bank,
    count: 20,
    filters: config,
    seed: "filters",
  });
  assert.ok(picked.length > 0);
  assert.equal(
    picked.every((item) => item.difficulty === 2 && item.tags.includes("food")),
    true,
  );
});

test("the fallback returns least recently seen items", () => {
  const seen = new Map(bank.map((item, index) => [item.id, index + 1]));
  seen.set("item-0", 1);
  seen.set("item-1", 2);
  const picked = pickItems({ items: bank, count: 1, seen, seed: "fallback" });
  assert.equal(picked[0].id, "item-0");
});

test("seeded selection is deterministic and recordSeen updates memory", () => {
  const first = pickItems({ items: bank, count: 5, seed: "repeat" });
  const second = pickItems({ items: bank, count: 5, seed: "repeat" });
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
  const seen = recordSeen(new Map(), first, 100);
  assert.equal(seen.size, 5);
});

test("seen rows older than 180 days are pruned", () => {
  const now = 200 * 24 * 60 * 60 * 1000;
  const seen = new Map([
    ["old", now - 181 * 24 * 60 * 60 * 1000],
    ["fresh", now - 10 * 24 * 60 * 60 * 1000],
  ]);
  pruneSeen(seen, now);
  assert.equal(seen.has("old"), false);
  assert.equal(seen.has("fresh"), true);
});
