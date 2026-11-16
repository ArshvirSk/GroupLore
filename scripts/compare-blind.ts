import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BLIND = path.join(ROOT, "docs/blind");
const REVIEW = path.join(ROOT, "docs/review-queue.md");

type Item = {
  id?: string;
  text?: string;
  answer?: string;
  aliases?: string[];
  isTrue?: boolean;
  answers?: Item[];
  groups?: Item[];
  words?: string[];
  [key: string]: unknown;
};
type Answer = string | boolean | string[] | string[][] | null;

const BANKS = [
  { id: "buzzer-trivia", file: "src/server/data/prompts/buzzerTrivia.json" },
  { id: "fact-or-fiction", file: "src/server/data/prompts/factOrFiction.json" },
  { id: "survey-says", file: "src/server/data/prompts/surveySays.json" },
  { id: "connections", file: "src/server/data/prompts/connections.json" },
];

const TIME_SENSITIVE =
  /\b(currently|today|right now|as of|reigning|incumbent|record holder|most recent|this year|next year)\b|\bcurrent (president|prime minister|champion|record|leader|price|population)\b/i;

function normalize(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(normalize).filter(Boolean) : [];
}

function groupKey(words: string[]) {
  return words.map(normalize).sort().join("|");
}

function compare(bankId: string, item: Item, answer: Answer): string {
  if (answer === "unsure" || answer === null || answer === undefined) return "marked unsure";
  if (TIME_SENSITIVE.test(String(item.text || ""))) return "time-sensitive wording";
  if (bankId === "buzzer-trivia") {
    const expected = [item.answer, ...(item.aliases || [])].map(normalize);
    return expected.includes(normalize(answer)) ? "" : "answer mismatch";
  }
  if (bankId === "fact-or-fiction") {
    return answer === item.isTrue ? "" : "true/false mismatch";
  }
  if (bankId === "survey-says") {
    if (!Array.isArray(answer)) return "survey answer must be an array";
    const expected = list((item.answers || []).map((entry) => entry.text));
    const actual = list(answer);
    // Survey boards are open-ended: many different eight-answer boards are
    // defensible. Require the blind answer to reproduce a majority of the
    // stored board, not the exact same eight strings.
    const matched = new Set(actual.filter((entry) => expected.includes(entry)));
    const needed = Math.min(5, expected.length);
    return matched.size >= needed ? "" : `survey board mismatch (${matched.size}/${expected.length})`;
  }
  if (bankId === "connections") {
    if (!Array.isArray(answer)) return "connections answer must be group arrays";
    const expected = (item.groups || []).map((group) => groupKey(group.words || [])).sort();
    const actual = (answer as string[][]).map(groupKey).sort();
    return JSON.stringify(expected) === JSON.stringify(actual) ? "" : "grouping mismatch";
  }
  return "";
}

const review: string[] = [
  "# Factual review queue",
  "",
  "Items removed after blind re-answering and comparison.",
  "",
];
for (const bank of BANKS) {
  const full = path.join(ROOT, bank.file);
  const data = JSON.parse(await readFile(full, "utf8"));
  const items: Item[] = Array.isArray(data) ? data : data.prompts;
  const files = (await readdir(BLIND))
    .filter(
      (file) =>
        file.startsWith(`${bank.id}-`) &&
        file.endsWith(".json") &&
        !file.endsWith(".answers.json"),
    )
    .sort();
  const answers = new Map<string, Answer>();
  let complete = true;
  for (const file of files) {
    const answerFile = file.replace(/\.json$/, ".answers.json");
    try {
      const payload = JSON.parse(await readFile(path.join(BLIND, answerFile), "utf8"));
      for (const [id, answer] of Object.entries(payload.answers || {})) {
        answers.set(id, answer as Answer);
      }
    } catch {
      complete = false;
      console.warn(`${bank.id}: missing ${answerFile}`);
    }
  }
  if (!complete) {
    console.warn(`${bank.id}: skipped removal until every chunk is answered`);
    continue;
  }
  const kept: Item[] = [];
  let removed = 0;
  for (const item of items) {
    const answer = answers.get(String(item.id));
    const reason = compare(bank.id, item, answer ?? "unsure");
    if (reason) {
      removed += 1;
      review.push(
        `- **${bank.id} / ${item.id}**: ${reason}\n  - ${String(item.text || item.id).slice(0, 220)}`,
      );
      continue;
    }
    kept.push(item);
  }
  if (Array.isArray(data)) await writeFile(full, `${JSON.stringify(kept, null, 2)}\n`);
  else {
    data.prompts = kept;
    await writeFile(full, `${JSON.stringify(data, null, 2)}\n`);
  }
  console.log(`${bank.id}: removed ${removed}, kept ${kept.length}`);
}
await writeFile(REVIEW, `${review.join("\n")}\n`);
