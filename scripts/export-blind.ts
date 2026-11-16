import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs/blind");

type Item = {
  id?: string;
  text?: string;
  category?: string;
  options?: unknown;
  unit?: string;
  groups?: Item[];
  words?: string[];
  [key: string]: unknown;
};

const BANKS = [
  { id: "buzzer-trivia", file: "src/server/data/prompts/buzzerTrivia.json" },
  { id: "fact-or-fiction", file: "src/server/data/prompts/factOrFiction.json" },
  { id: "survey-says", file: "src/server/data/prompts/surveySays.json" },
  { id: "connections", file: "src/server/data/prompts/connections.json" },
];

function shuffled(items: string[], seedText: string) {
  const copy = [...items];
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function blindItem(bankId: string, item: Item) {
  if (bankId === "connections") {
    const words = (item.groups || []).flatMap((group) => group.words || []);
    return {
      id: item.id,
      words: shuffled(words.map(String), String(item.id)),
      instruction: "Group the 16 words into four groups of four.",
    };
  }
  return {
    id: item.id,
    question: item.text,
    ...(item.category ? { category: item.category } : {}),
    ...(item.options ? { options: item.options } : {}),
    ...(item.unit ? { unit: item.unit } : {}),
  };
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const bank of BANKS) {
  const data = JSON.parse(await readFile(path.join(ROOT, bank.file), "utf8"));
  const items: Item[] = Array.isArray(data) ? data : data.prompts;
  const chunks: Item[][] = [];
  for (let index = 0; index < items.length; index += 50) {
    chunks.push(items.slice(index, index + 50));
  }
  for (const [index, chunk] of chunks.entries()) {
    const name = `${bank.id}-${String(index + 1).padStart(3, "0")}`;
    await writeFile(
      path.join(OUT, `${name}.json`),
      `${JSON.stringify(chunk.map((item) => blindItem(bank.id, item)), null, 2)}\n`,
    );
  }
  console.log(`${bank.id}: ${chunks.length} chunks, ${items.length} items`);
}
