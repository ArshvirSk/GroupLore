import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/server/data/prompts");
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function rewrite(text, rules) {
  for (const [pattern, replace] of rules) {
    const match = text.match(pattern);
    if (match) return cap(replace(match));
  }
  return text;
}

const roastRules = [
  [/^The worst thing to bring to (.+)$/i, (m) => `${m[1]}: the worst thing to bring`],
  [/^The worst thing to (\w+) (?:in|at|on|during|from|for|to) (.+)$/i, (m) => `${m[2]}: the worst thing to ${m[1]}`],
  [/^The worst name for (.+)$/i, (m) => `${m[1]}: the worst possible name`],
];
const acronymRules = [
  [/^A bad name for (.+)$/i, (m) => `${m[1]}: a bad name`],
  [/^A terrible name for (.+)$/i, (m) => `${m[1]}: a terrible name`],
  [/^A new rule for (.+)$/i, (m) => `${m[1]}: a new rule`],
  [/^A strange thing to (\w+) (?:to|in|at|on|during|from|for) (.+)$/i, (m) => `${m[2]}: a strange thing to ${m[1]}`],
  [/^A strange thing to name (.+)$/i, (m) => `${m[1]}: a strange thing to name`],
  [/^A strange thing to sell online$/i, () => "Online marketplaces: a strange thing to sell"],
];
const fillRules = [
  [/^The worst thing to bring to (.+)$/i, (m) => `${m[1]}: the worst thing to bring`],
  [/^The worst thing to find in your (.+)$/i, (m) => `Your ${m[1]}: the worst thing to find`],
  [/^The worst thing to (\w+) (?:during|on|at|in) (.+)$/i, (m) => `${m[2]}: the worst thing to ${m[1]}`],
  [/^The best thing to say after (.+)$/i, (m) => `${m[1]}: the best thing to say`],
  [/^A suspiciously specific birthday gift for (.+)$/i, (m) => `${m[1]}: a suspiciously specific birthday gift`],
  [/^The new flavor at (.+) that nobody asked for$/i, (m) => `${m[1]}: the new flavor nobody asked for`],
  [/^The worst superpower for (.+)$/i, (m) => `${m[1]}: the worst superpower`],
  [/^The one rule every (.+) should follow$/i, (m) => `${m[1]}: the one rule everyone should follow`],
  [/^The most dramatic way to announce (.+)$/i, (m) => `${m[1]}: the most dramatic way to announce it`],
  [/^A terrible theme for (.+)$/i, (m) => `${m[1]}: a terrible theme`],
  [/^The most useless app for (.+)$/i, (m) => `${m[1]}: the most useless app`],
];

async function apply(file, rules, select = (data) => data) {
  const full = path.join(DIR, file);
  const data = JSON.parse(await readFile(full, "utf8"));
  let changed = 0;
  for (const item of select(data)) {
    const next = rewrite(item.text, rules);
    if (next !== item.text) changed += 1;
    item.text = next;
  }
  await writeFile(full, `${JSON.stringify(data, null, 2)}\n`);
  console.log(file, changed);
}

await apply("roastBattle.json", roastRules);
await apply("acronymWars.json", acronymRules);
await apply("fillTheBlank.json", fillRules, (data) => data.prompts);
