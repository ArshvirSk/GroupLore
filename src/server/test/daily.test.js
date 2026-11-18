import assert from "node:assert/strict";
import { test } from "node:test";
import blurGuess, { dailyBlurImages } from "../games/blurGuess.js";
import connections, { dailyConnectionsPuzzle } from "../games/connections.js";
import { dailyIndex, dailyKey, seededShuffle } from "../lib/daily.js";
import {
  summarizeDailyProgress,
  summarizeDailyStreak,
} from "../lib/dailyProgress.js";

test("daily keys use the UTC calendar day", () => {
  assert.equal(dailyKey(new Date("2026-11-15T23:59:59Z")), "2026-11-15");
  assert.equal(dailyKey(new Date("2026-11-16T00:00:00Z")), "2026-11-16");
});

test("daily selection is stable for a date and changes with the date", () => {
  const items = Array.from({ length: 12 }, (_, index) => index);
  const first = seededShuffle(items, "2026-11-15");
  assert.deepEqual(seededShuffle(items, "2026-11-15"), first);
  assert.notDeepEqual(seededShuffle(items, "2026-11-16"), first);
  assert.deepEqual(items, Array.from({ length: 12 }, (_, index) => index));
  assert.equal(dailyIndex(12, "2026-11-15"), dailyIndex(12, "2026-11-15"));
  assert.equal(dailyIndex(0), -1);
});

test("daily Connections uses one puzzle per UTC date", () => {
  const today = dailyKey();
  const first = dailyConnectionsPuzzle(today);
  assert.equal(dailyConnectionsPuzzle(today), first);
  assert.notEqual(dailyConnectionsPuzzle("2099-01-01").id, first.id);

  const room = {
    mode: "daily",
    players: new Map([
      ["a", { id: "a", connected: true }],
      ["b", { id: "b", connected: true }],
    ]),
    scores: {},
  };
  const state = connections.init(room, "daily");
  assert.equal(state.puzzle.id, first.id);
  assert.equal(state.config.coOp, false);
});

test("group daily progress dedupes replays and counts UTC-day streaks", () => {
  const rows = [
    { game_type: "blur-guess", created_at: "2026-11-15T12:00:00.000Z" },
    { game_type: "blur-guess", created_at: "2026-11-15T09:00:00.000Z" },
    { game_type: "connections", created_at: "2026-11-14T20:00:00.000Z" },
    { game_type: "connections", created_at: "2026-11-13T12:00:00.000Z" },
    { game_type: "blur-guess", created_at: "2026-11-11T12:00:00.000Z" },
    { game_type: "blur-guess", created_at: "not-a-date" },
  ];

  const progress = summarizeDailyProgress(rows, "2026-11-15");
  assert.deepEqual(progress.streak, {
    current: 3,
    best: 3,
    completedToday: true,
    lastCompleted: "2026-11-15",
  });
  assert.deepEqual([...progress.completedGames], ["blur-guess"]);
});

test("group completion keeps the puzzle's UTC date across midnight", () => {
  const progress = summarizeDailyProgress(
    [
      {
        game_type: "blur-guess",
        daily_date: "2026-11-14",
        created_at: "2026-11-15T00:05:00.000Z",
      },
    ],
    "2026-11-15",
  );
  assert.equal(progress.streak.completedToday, false);
  assert.equal(progress.streak.lastCompleted, "2026-11-14");
  assert.equal(progress.streak.current, 1);
});

test("a streak stays current through yesterday but not after a missed day", () => {
  const yesterday = summarizeDailyStreak(
    ["2026-11-13", "2026-11-14"],
    "2026-11-15",
  );
  assert.equal(yesterday.current, 2);
  assert.equal(yesterday.completedToday, false);

  const missed = summarizeDailyStreak(["2026-11-13"], "2026-11-15");
  assert.equal(missed.current, 0);
  assert.equal(missed.best, 1);
});

test("daily Blur Guess deals five shared images", () => {
  const today = dailyKey();
  const images = dailyBlurImages(today);
  assert.equal(images.length, 5);
  assert.deepEqual(dailyBlurImages(today), images);
  assert.notDeepEqual(
    dailyBlurImages("2099-01-01").map((image) => image.id),
    images.map((image) => image.id),
  );

  const room = { mode: "daily", players: new Map(), scores: {} };
  const state = blurGuess.init(room, "daily");
  assert.equal(state.rounds, 5);
  assert.deepEqual(
    state.images.map((image) => image.id),
    images.map((image) => image.id),
  );
});
