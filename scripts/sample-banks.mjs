import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/server/data/prompts");
const BANKS = [
  ["acronym-wars", "acronymWars.json"],
  ["avoid-the-answer", "avoidTheAnswer.json"],
  ["blind-sketch", "blindSketch.json"],
  ["bluff", "bluff.json"],
  ["buzzer-trivia (factual)", "buzzerTrivia.json"],
  ["caption-this", "captionThis.json"],
  ["category-rush", "categoryRush.json"],
  ["codenames", "codenames.json"],
  ["connections", "connections.json"],
  ["fact-or-fiction (factual)", "factOrFiction.json"],
  ["fill-the-blank", "fillTheBlank.json"],
  ["five-second", "fiveSecond.json"],
  ["guess-impostor", "impostor.json"],
  ["higher-or-lower", "higherLower.json"],
  ["hive-mind", "hive.json"],
  ["hot-takes", "hotTakes.json"],
  ["mad-libs", "madLibs.json"],
  ["most-likely-to", "mostLikelyTo.json"],
  ["overrated-underrated", "overrated.json"],
  ["password", "password.json"],
  ["pitch-perfect", "pitchPerfect.json"],
  ["roast-battle", "roastBattle.json"],
  ["scattergories", "scattergories.json"],
  ["story-chain", "storyChain.json"],
  ["survey-says", "surveySays.json"],
  ["two-truths", "twoTruths.json"],
  ["wavelength", "wavelength.json"],
  ["would-you-rather", "wouldYouRather.json"],
];

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pick(items, count = 5, seed = 20261116) {
  const copy = [...items];
  const random = seededRandom(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function factualSample(items) {
  const random = pick(items, 5, 20261116);
  const hardest = [...items]
    .sort((a, b) => {
      const difficulty = Number(b.difficulty || 0) - Number(a.difficulty || 0);
      return difficulty || String(b.text || "").length - String(a.text || "").length;
    })
    .slice(0, 5);
  const seen = new Set();
  return [...random, ...hardest].filter((item) => {
    const id = String(item.id || "");
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function describe(item) {
  if (!item || typeof item !== "object") return String(item);
  if (Array.isArray(item.groups)) {
    return item.groups.map((group) => `${group.category}: ${group.words.join(", ")}`).join(" / ");
  }
  const text = item.text || item.question || item.prompt || item.scenario || item.id;
  const answer = item.answer ? ` → ${item.answer}` : "";
  const options = item.options ? ` [${item.options.join(" | ")}]` : "";
  const categories = item.categories ? ` [${item.categories.join(", ")}]` : "";
  return `${text}${answer}${options}${categories}`;
}

let out = "# Content spot-check samples\n\nDeterministic five-item sample per shipped bank. Factual banks are listed separately.\n";
for (const [name, file] of BANKS) {
  const data = JSON.parse(await readFile(path.join(DIR, file), "utf8"));
  let items = Array.isArray(data) ? data : data.prompts;
  if (file === "fillTheBlank.json") {
    out += "\n## Fill the Blank prompts\n";
    for (const item of pick(items)) out += `- ${describe(item)}\n`;
    out += "\n## Fill the Blank answers\n";
    for (const item of pick(data.answers)) out += `- ${describe(item)}\n`;
    continue;
  }
  out += `\n## ${name}\n`;
  const sample = name.includes("factual") ? factualSample(items) : pick(items);
  for (const item of sample) out += `- ${describe(item)}\n`;
}
out += "\n## Connections consistency note\n\nConnections samples show all four categories so the group can be checked as a set.\n";
await writeFile(path.join(process.cwd(), "docs/content-samples.md"), out);
console.log("wrote docs/content-samples.md");
