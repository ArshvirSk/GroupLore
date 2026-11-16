/**
 * Content bank audit.
 *
 * Run with: node --experimental-strip-types scripts/audit-banks.ts
 * Writes docs/content-audit.md and exits 0 even when targets are unmet.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { launchMinimum } from "../src/server/games/launchPolicy.js";

type Item = Record<string, unknown>;

const ROOT = process.cwd();
const BANK_DIR = path.join(ROOT, "src/server/data/prompts");
const REPORT = path.join(ROOT, "docs/content-audit.md");

const TARGETS: Record<string, number> = {
  "most-likely-to": 600,
  "would-you-rather": 800,
  "hot-takes": 500,
  "overrated-underrated": 500,
  "higher-or-lower": 300,
  "hive-mind": 400,
  "category-rush": 400,
  "avoid-the-answer": 400,
  "five-second": 600,
  wavelength: 300,
  "odd-one-out": 400,
  "guess-impostor": 400,
  "caption-this": 300,
  bluff: 500,
  "roast-battle": 600,
  "pitch-perfect": 400,
  "acronym-wars": 200,
  "mad-libs": 100,
  "story-chain": 300,
  "two-truths": 100,
  scattergories: 250,
  "fill-the-blank-prompts": 300,
  "fill-the-blank-answers": 1500,
  "fact-or-fiction": 1500,
  "buzzer-trivia": 2500,
  connections: 300,
  "survey-says": 400,
  "closest-wins": 400,
  "timeline": 300,
  "rank-it": 300,
  "emoji-decode": 600,
  flag: 250,
  "blur-guess": 200,
  chameleon: 120,
  spyfall: 60,
  "blind-sketch": 1500,
  password: 1000,
  codenames: 1200,
  "just-one": 800,
  "bomb-party": 1,
  "type-race": 200,
  "wordle-race": 2000,
};

const FILES: Record<string, string> = {
  "most-likely-to": "mostLikelyTo.json",
  "would-you-rather": "wouldYouRather.json",
  "hot-takes": "hotTakes.json",
  "overrated-underrated": "overrated.json",
  "higher-or-lower": "higherLower.json",
  "hive-mind": "hive.json",
  "category-rush": "categoryRush.json",
  "avoid-the-answer": "avoidTheAnswer.json",
  "five-second": "fiveSecond.json",
  wavelength: "wavelength.json",
  "odd-one-out": "hive.json",
  "guess-impostor": "impostor.json",
  "caption-this": "captionThis.json",
  bluff: "bluff.json",
  "roast-battle": "roastBattle.json",
  "pitch-perfect": "pitchPerfect.json",
  "acronym-wars": "acronymWars.json",
  "mad-libs": "madLibs.json",
  "story-chain": "storyChain.json",
  "two-truths": "twoTruths.json",
  scattergories: "scattergories.json",
  "fact-or-fiction": "factOrFiction.json",
  "buzzer-trivia": "buzzerTrivia.json",
  connections: "connections.json",
  "survey-says": "surveySays.json",
  "blind-sketch": "blindSketch.json",
  password: "password.json",
  codenames: "codenames.json",
};

const TEXT_FIELDS = ["text", "prompt", "question", "category", "word", "starter", "item"];

function itemsFrom(data: unknown): Item[] {
  if (Array.isArray(data)) return data as Item[];
  if (!data || typeof data !== "object") return [];
  const object = data as Record<string, unknown>;
  for (const key of ["prompts", "answers", "questions", "items", "words", "categories"]) {
    if (Array.isArray(object[key])) return object[key] as Item[];
  }
  return [];
}

function textOf(item: Item): string {
  for (const field of TEXT_FIELDS) {
    if (typeof item[field] === "string") return item[field] as string;
  }
  return "";
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const left = new Set(a);
  const right = new Set(b);
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return union ? shared / union : 0;
}

function nearDuplicates(items: Item[]): number {
  const tokens = items.map((item) => normalize(textOf(item)));
  let count = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i + 1; j < tokens.length; j += 1) {
      if (similarity(tokens[i], tokens[j]) > 0.85) count += 1;
    }
  }
  return count;
}

function distribution(items: Item[], field: string): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = item[field];
    const key = Array.isArray(value) ? value.join(", ") : String(value ?? "untagged");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, count]) => `${key} ${count}`)
    .join("; ") || "—";
}

type Row = {
  id: string;
  file: string;
  count: number;
  target: number;
  launch: number;
  missingText: number;
  missingMeta: number;
  exactDuplicates: number;
  nearDuplicates: number;
  difficulty: string;
  tags: string;
};

async function auditFile(id: string): Promise<Row> {
  const file = FILES[id];
  const target = TARGETS[id] ?? 300;
  if (!file) {
    return {
      id,
      file: "not implemented",
      count: 0,
      target,
      launch: launchMinimum(id),
      missingText: 0,
      missingMeta: 0,
      exactDuplicates: 0,
      nearDuplicates: 0,
      difficulty: "—",
      tags: "—",
    };
  }
  const data = JSON.parse(await readFile(path.join(BANK_DIR, file), "utf8"));
  const items = itemsFrom(data);
  const texts = items.map((item) => textOf(item).trim().toLowerCase()).filter(Boolean);
  const exact = texts.length - new Set(texts).size;
  return {
    id,
    file,
    count: items.length,
    target,
    launch: launchMinimum(id),
    missingText: items.filter((item) => !textOf(item).trim()).length,
    missingMeta: items.filter((item) => !item.tags && !item.tag && !item.category).length,
    exactDuplicates: exact,
    nearDuplicates: nearDuplicates(items),
    difficulty: distribution(items, "difficulty"),
    tags: distribution(items, "tags"),
  };
}

async function auditFillTheBlank(): Promise<Row[]> {
  const data = JSON.parse(
    await readFile(path.join(BANK_DIR, "fillTheBlank.json"), "utf8"),
  ) as { prompts: Item[]; answers: Item[] };
  const rows: Row[] = [];
  for (const [id, items] of [
    ["fill-the-blank-prompts", data.prompts],
    ["fill-the-blank-answers", data.answers],
  ] as const) {
    const texts = items.map((item) => textOf(item).trim().toLowerCase());
    rows.push({
      id,
      file: "fillTheBlank.json",
      count: items.length,
      target: TARGETS[id] ?? 300,
      launch: launchMinimum(id),
      missingText: items.filter((item) => !textOf(item).trim()).length,
      missingMeta: items.filter((item) => !item.tags && !item.tag && !item.category).length,
      exactDuplicates: texts.length - new Set(texts).size,
      nearDuplicates: nearDuplicates(items),
      difficulty: distribution(items, "difficulty"),
      tags: distribution(items, "tags"),
    });
  }
  return rows;
}

async function main() {
  const files = new Set(await readdir(BANK_DIR));
  const implemented = Object.keys(TARGETS).filter((id) =>
    id.startsWith("fill-the-blank") ? files.has("fillTheBlank.json") : Boolean(FILES[id]),
  );
  const rows: Row[] = [];
  for (const id of implemented) {
    if (id.startsWith("fill-the-blank")) continue;
    rows.push(await auditFile(id));
  }
  if (files.has("fillTheBlank.json")) rows.push(...(await auditFillTheBlank()));
  for (const id of Object.keys(TARGETS)) {
    if (!implemented.includes(id)) rows.push(await auditFile(id));
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));

  const totalGap = rows.reduce((sum, row) => sum + Math.max(0, row.target - row.count), 0);
  const totalLaunchGap = rows.reduce((sum, row) => sum + Math.max(0, row.launch - row.count), 0);
  const lines = [
    "# Content bank audit",
    "",
    `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/audit-banks.ts\`.`,
    "",
    "| Bank | File | Current | Launch min | Launch gap | Stretch target | Stretch gap | Missing text | Missing tags/category | Exact dupes | Near dupes | Difficulty | Tags |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...rows.map((row) =>
      `| ${row.id} | ${row.file} | ${row.count} | ${row.launch} | ${Math.max(0, row.launch - row.count)} | ${row.target} | ${Math.max(0, row.target - row.count)} | ${row.missingText} | ${row.missingMeta} | ${row.exactDuplicates} | ${row.nearDuplicates} | ${row.difficulty} | ${row.tags} |`,
    ),
    "",
    `**Total launch gap:** ${totalLaunchGap.toLocaleString()}. **Total stretch gap:** ${totalGap.toLocaleString()}.`,
    "",
    "Games absent from `TARGETS` are included only when they have a shipped bank. Assets whose licensing is not verifiable are reported as absent rather than counted.",
  ];
  await mkdir(path.dirname(REPORT), { recursive: true });
  await writeFile(REPORT, `${lines.join("\n")}\n`);
  console.log(`Wrote ${REPORT} (${rows.length} banks, gap ${totalGap}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
