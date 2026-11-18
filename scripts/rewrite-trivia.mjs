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
  // fiveSecond, hive, impostor and surveySays are deliberately not rewritten:
  // namePrompt turned "Name a fruit" into the article-less "What's fruit" and
  // "Name something in a bathroom" into "In a bathroom, what's something?".
  // Those four banks have been repaired by hand; do not re-add them here.
];

/*
 * namePrompt() used to rewrite fiveSecond, hive, impostor and surveySays
 * prompts. It stripped articles ("Name a fruit" became "What's fruit") and
 * flattened places ("Name something in a bathroom" became "In a bathroom,
 * what's something?"), so it has been removed. Those four banks carry their
 * own hand-maintained wording now; do not reintroduce a text transform for
 * them here.
 */

for (const [file, transform] of stemRewrites) {
  const data = await read(file);
  const items = Array.isArray(data) ? data : data.prompts;
  for (const item of items) item.text = transform(item.text);
  await write(file, data);
}

const higher = await read("higherLower.json");
for (const item of higher) {
  const match = item.category.match(/^most likely to become (.+)$/i);
  if (match) item.category = `Becoming ${match[1]}: how likely?`;
}
await write("higherLower.json", higher);
