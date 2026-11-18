import { dailyKey } from "./daily.js";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function shiftDay(key, offset) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function summarizeDailyStreak(dates, today = dailyKey()) {
  const days = new Set(
    (dates || []).map(String).filter((date) => DATE_KEY.test(date)),
  );
  const sorted = [...days].sort();
  const lastCompleted = sorted.at(-1) || null;

  let current = 0;
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    run = previous && shiftDay(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return {
    current,
    best,
    completedToday: days.has(today),
    lastCompleted,
  };
}

/**
 * Turn finished daily-game recaps into group progress. A replay creates another
 * recap row, so days are deduplicated rather than treated as a new completion.
 */
export function summarizeDailyProgress(rows, today = dailyKey()) {
  const days = [];
  const completedGames = new Set();

  for (const row of rows || []) {
    const completedAt = String(row?.created_at || "");
    const finished = new Date(completedAt);
    if (Number.isNaN(finished.getTime())) continue;

    const recordedDay = String(row?.daily_date || "");
    const day = DATE_KEY.test(recordedDay) ? recordedDay : dailyKey(finished);
    const gameId = String(row?.game_type || "");
    days.push(day);

    if (gameId && day === today) completedGames.add(gameId);
  }

  return {
    today,
    streak: summarizeDailyStreak(days, today),
    completedGames,
  };
}
