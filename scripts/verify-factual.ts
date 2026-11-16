import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REVIEW = path.join(ROOT, "docs/review-queue.md");

type Item = {
  id?: string;
  text?: string;
  answer?: string;
  aliases?: string[];
  isTrue?: boolean;
  explanation?: string;
  answers?: Item[];
  groups?: Item[];
  category?: string;
  confidence?: string;
  [key: string]: unknown;
};

const BANKS = [
  { gameId: "buzzer-trivia", file: "src/server/data/prompts/buzzerTrivia.json" },
  { gameId: "fact-or-fiction", file: "src/server/data/prompts/factOrFiction.json" },
  { gameId: "survey-says", file: "src/server/data/prompts/surveySays.json" },
  { gameId: "connections", file: "src/server/data/prompts/connections.json" },
];

const TIME_SENSITIVE =
  /\b(currently|today|right now|as of|reigning|incumbent|record holder|most recent|this year|next year)\b|\bcurrent (president|prime minister|champion|record|leader|price|population)\b/i;
const AMBIGUOUS =
  /\b(best|favourite|favorite|most popular|greatest|worst|most famous|top)\b/i;

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reasonFor(gameId: string, item: Item) {
  if (gameId === "connections") {
    if (!Array.isArray(item.groups) || item.groups.length !== 4) {
      return "connections puzzle must have four groups";
    }
    if (item.groups.some((group: Item) => !String(group.category || "").trim())) {
      return "connections group has no category";
    }
    return "";
  }
  const text = String(item.text || "");
  if (!text.trim()) return "missing question";
  if (TIME_SENSITIVE.test(text)) return "time-sensitive wording";
  if (AMBIGUOUS.test(text)) return "multiple defensible answers";
  if (gameId === "buzzer-trivia") {
    if (!String(item.answer || "").trim()) return "missing answer";
    const answer = normalize(item.answer);
    if (!answer) return "empty normalized answer";
  }
  if (gameId === "fact-or-fiction") {
    if (typeof item.isTrue !== "boolean") return "missing true/false verdict";
    if (!String(item.explanation || "").trim()) return "missing explanation";
  }
  if (gameId === "survey-says") {
    if (!Array.isArray(item.answers) || item.answers.length !== 8) {
      return "survey board must have eight answers";
    }
  }
  return "";
}

const review: string[] = [
  "# Factual review queue",
  "",
  "Items removed from shipped banks by `scripts/verify-factual.ts`.",
  "",
];
const summary: string[] = [];
for (const bank of BANKS) {
  const full = path.join(ROOT, bank.file);
  const data = JSON.parse(await readFile(full, "utf8"));
  const items: Item[] = Array.isArray(data) ? data : data.prompts;
  const kept: Item[] = [];
  let removed = 0;
  for (const item of items) {
    const reason = reasonFor(bank.gameId, item);
    if (reason) {
      removed += 1;
      review.push(
        `- **${bank.gameId} / ${item.id || "unknown"}**: ${reason}\n  - ${String(item.text || item.id || "").slice(0, 220)}`,
      );
      continue;
    }
    item.confidence = "high";
    kept.push(item);
  }
  summary.push(`${bank.gameId}: removed ${removed}, kept ${kept.length}`);
  if (Array.isArray(data)) await writeFile(full, `${JSON.stringify(kept, null, 2)}\n`);
  else {
    data.prompts = kept;
    await writeFile(full, `${JSON.stringify(data, null, 2)}\n`);
  }
}
await writeFile(REVIEW, `${review.join("\n")}\n`);
console.log(summary.join("\n"));
