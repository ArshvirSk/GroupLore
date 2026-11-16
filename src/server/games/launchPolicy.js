// Items a single session normally consumes. Launch banks cover ten sessions.
const CONSUMED_PER_SESSION = {
  "fill-the-blank-prompts": 10,
  "fact-or-fiction": 30,
  "fact-or-fiction:mode": 30,
  "buzzer-trivia": 10,
  codenames: 25,
  "blind-sketch": 6,
};

export function launchMinimum(gameId) {
  const consumed = CONSUMED_PER_SESSION[gameId] || 10;
  return Math.min(400, Math.max(150, consumed * 10));
}
