import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/server/data/prompts");
const BASE = {
  "acronymWars.json": ["wordplay"],
  "avoidTheAnswer.json": ["describe"],
  "blindSketch.json": ["drawing"],
  "bluff.json": ["vocabulary"],
  "buzzerTrivia.json": ["trivia"],
  "captionThis.json": ["caption"],
  "categoryRush.json": ["category"],
  "codenames.json": ["wordplay"],
  "connections.json": ["puzzle"],
  "factOrFiction.json": ["trivia"],
  "fillTheBlank.json": ["prompt"],
  "fiveSecond.json": ["quick"],
  "higherLower.json": ["rating"],
  "hive.json": ["social"],
  "hotTakes.json": ["opinion"],
  "impostor.json": ["deduction"],
  "liarsBar.json": ["social"],
  "madLibs.json": ["story"],
  "mostLikelyTo.json": ["social"],
  "overrated.json": ["rating"],
  "password.json": ["wordplay"],
  "pitchPerfect.json": ["product"],
  "roastBattle.json": ["comedy"],
  "scattergories.json": ["category"],
  "storyChain.json": ["story"],
  "surveySays.json": ["survey"],
  "twoTruths.json": ["personal"],
  "wavelength.json": ["spectrum"],
  "wouldYouRather.json": ["choice"],
};

const TOPICS = [
  [/food|cook|eat|pizza|snack|meal|breakfast|dinner|fruit|vegetable|coffee|tea|cake|bread/i, "food"],
  [/travel|holiday|trip|airport|hotel|beach|city|country|train|plane|road/i, "travel"],
  [/science|planet|space|chemical|element|energy|animal|species|physics|biology/i, "science"],
  [/school|teacher|student|homework|class|exam|library/i, "school"],
  [/work|office|job|meeting|boss|career|interview/i, "work"],
  [/phone|computer|app|tech|robot|internet|email/i, "tech"],
  [/sport|football|cricket|tennis|basketball|race|olympic|gym/i, "sport"],
  [/film|movie|cinema|tv|show|series/i, "film"],
  [/music|song|album|band|concert|sing/i, "music"],
  [/game|board|card|puzzle|quiz/i, "games"],
  [/india|delhi|mumbai|bengaluru|chennai|kolkata|hyderabad/i, "india"],
  [/family|friend|neighbour|party|wedding|group/i, "social"],
];

function textFor(item) {
  return Object.values(item)
    .filter((value) => typeof value === "string")
    .join(" ");
}

function decorate(item, baseTags) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return;
  const text = textFor(item);
  if (!Array.isArray(item.tags) || !item.tags.length) {
    const tags = new Set(baseTags);
    for (const [pattern, tag] of TOPICS) {
      if (pattern.test(text)) tags.add(tag);
    }
    item.tags = [...tags].slice(0, 4);
  }
  if (item.rating !== "spicy") item.rating = "all";
}

const files = (await readdir(DIR)).filter((file) => file.endsWith(".json"));
for (const file of files) {
  if (!BASE[file]) continue;
  const full = path.join(DIR, file);
  const data = JSON.parse(await readFile(full, "utf8"));
  const baseTags = BASE[file];
  if (Array.isArray(data)) {
    for (const item of data) decorate(item, baseTags);
    if (file === "scattergories.json") {
      for (const item of data) {
        if (Array.isArray(item.categories)) item.tags = ["category", "wordplay"];
      }
    }
  } else if (data && typeof data === "object") {
    for (const key of ["prompts", "answers", "questions", "items", "words"]) {
      if (Array.isArray(data[key])) {
        for (const item of data[key]) {
          decorate(item, key === "answers" ? ["answer"] : baseTags);
        }
      }
    }
  }
  await writeFile(full, `${JSON.stringify(data, null, 2)}\n`);
}
