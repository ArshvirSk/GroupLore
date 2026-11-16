/**
 * Content bank validation.
 *
 * Run with: node --experimental-strip-types scripts/validate-banks.ts
 * Add --no-targets to check structure without failing on bank size.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateBank } from "../src/server/games/bankValidation.js";

const ROOT = process.cwd();
const BANK_DIR = path.join(ROOT, "src/server/data/prompts");
const checkTargets = !process.argv.includes("--no-targets");

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
  timeline: 300,
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

function itemsFrom(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const object = data as Record<string, unknown>;
  for (const key of ["prompts", "answers", "questions", "items", "words", "categories"]) {
    if (Array.isArray(object[key])) return object[key] as Record<string, unknown>[];
  }
  return [];
}

async function main() {
  const results: ReturnType<typeof validateBank>[] = [];
  const loaded = new Map<string, unknown>();
  const ids = new Set([
    ...Object.keys(TARGETS),
    ...Object.keys(FILES),
    "fill-the-blank-prompts",
    "fill-the-blank-answers",
  ]);

  for (const id of ids) {
    const file = FILES[id] || (id.startsWith("fill-the-blank") ? "fillTheBlank.json" : null);
    if (!file) {
      const result = validateBank({ gameId: id, items: [], target: 0 });
      if (checksTargets()) {
        result.errors.push(
          `${id}: 0/${TARGETS[id] || 300} items (bank not implemented; bank below target)`,
        );
      }
      results.push(result);
      continue;
    }
    if (!loaded.has(file)) {
      const raw = await readFile(path.join(BANK_DIR, file), "utf8");
      loaded.set(file, JSON.parse(raw));
    }
    const data = loaded.get(file);
    const items: Record<string, unknown>[] = id.startsWith("fill-the-blank")
      ? ((data as Record<string, unknown>)[id.endsWith("answers") ? "answers" : "prompts"] as Record<string, unknown>[])
      : itemsFrom(data);
    results.push(
      validateBank({
        gameId: id,
        items,
        target: checkTargets ? TARGETS[id] || 300 : 0,
        skipNearDuplicates:
          id === "fact-or-fiction" || id === "scattergories",
      }),
    );
  }

  const errors = results.flatMap((result) => result.errors);
  const warnings = results.flatMap((result) => result.warnings);
  for (const result of results) {
    const status = result.errors.length ? "FAIL" : "ok";
    console.log(
      `${status.padEnd(4)} ${result.gameId}: ${result.count}/${result.target || "—"} items`,
    );
  }
  for (const result of results) {
    if (!result.patterns?.stemFailures.length && !result.patterns?.familyFailures.length) {
      continue;
    }
    console.log(`\n${result.gameId} top stems:`);
    for (const entry of result.patterns.stems) {
      console.log(`  ${entry.count}\t${entry.key}`);
    }
  }
  for (const error of errors.slice(0, 80)) console.log(`  ERROR ${error}`);
  for (const warning of warnings.slice(0, 40)) console.log(`  WARN  ${warning}`);
  console.log(
    `\n${results.length} banks · ${errors.length} errors · ${warnings.length} warnings`,
  );
  if (errors.length) process.exitCode = 1;
}

function checksTargets() {
  return checkTargets;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
