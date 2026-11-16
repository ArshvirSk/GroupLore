import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/server/data/prompts");
const read = async (file) => JSON.parse(await readFile(path.join(DIR, file), "utf8"));
const write = async (file, data) =>
  writeFile(path.join(DIR, file), `${JSON.stringify(data, null, 2)}\n`);

const stemRewrites = [
  ["mostLikelyTo.json", (text) => {
    if (!text.startsWith("Most likely to ")) return text;
    const rest = text.slice(15).replace(/[?.!]*$/, "");
    if (rest.startsWith("have a ")) return `A ${rest.slice(7)}: who would have it?`;
    if (rest.startsWith("be the ")) return `The ${rest.slice(7)}: who would be that?`;
    if (rest.startsWith("turn a ")) return `Turning a ${rest.slice(7)}: who would do that?`;
    return `Who would ${rest}?`;
  }],
  ["fiveSecond.json", namePrompt],
  ["hive.json", namePrompt],
  ["impostor.json", namePrompt],
  ["surveySays.json", namePrompt],
];

function namePrompt(text) {
  if (text.startsWith("Most likely to ")) {
    const rest = text.slice(15).replace(/[?.!]*$/, "");
    return `Who would ${rest}?`;
  }
  if (/^Name a food that is better (.+)$/.test(text)) {
    return text.replace(/^Name a food that is better (.+)$/, "Better $1: which food?");
  }
  if (/^Name a type of (.+)$/.test(text)) {
    return text.replace(/^Name a type of (.+)$/, "Which type of $1?");
  }
  if (/^Name a (food|song|place|movie|show|game|drink) that (.+)$/.test(text)) {
    return text.replace(
      /^Name a (food|song|place|movie|show|game|drink) that (.+)$/,
      "Which $1 $2?",
    );
  }
  if (/^Name a thing you (.+)$/.test(text)) {
    return text.replace(/^Name a thing you (.+)$/, "What would you $1?");
  }
  if (/^Name a thing that (.+)$/.test(text)) {
    return text.replace(/^Name a thing that (.+)$/, "Which thing $1?");
  }
  if (/^Name something (in|at|on|during|from) (.+)$/.test(text)) {
    return text.replace(
      /^Name something (in|at|on|during|from) (.+)$/,
      "In $2, what's something?",
    );
  }
  if (/^Name something that (is|makes|has|takes|feels|seems) (.+)$/.test(text)) {
    return text.replace(
      /^Name something that (is|makes|has|takes|feels|seems) (.+)$/,
      "What $1 $2?",
    );
  }
  if (/^Name something you (would|can|could|never|always) (.+)$/.test(text)) {
    return text.replace(
      /^Name something you (would|can|could|never|always) (.+)$/,
      "What would you $2?",
    );
  }
  if (/^Name an? (.+)$/.test(text)) {
    return text.replace(/^Name an? (.+)$/, "What's $1");
  }
  return text;
}

for (const [file, transform] of stemRewrites) {
  const data = await read(file);
  const items = Array.isArray(data) ? data : data.prompts;
  for (const item of items) item.text = transform(item.text);
  if (file === "higherLower.json") {
    // handled separately below
  }
  if (file === "hive.json") {
    for (const item of items) item.odd = transform(item.odd);
  }
  await write(file, data);
}

const higher = await read("higherLower.json");
for (const item of higher) {
  const match = item.category.match(/^most likely to become (.+)$/i);
  if (match) item.category = `Becoming ${match[1]}: how likely?`;
}
await write("higherLower.json", higher);
