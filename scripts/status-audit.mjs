import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { bankStatus } from "../src/server/games/bankStatus.js";

const ROOT = process.cwd();
const registry = (await import("../src/server/games/index.js")).default;
const registryIds = [...registry.keys()].filter((id) => id !== "engine-stub").sort();

const gamePage = await readFile("src/app/game/[sessionId]/page.tsx", "utf8");
const roundTwo = await readFile("src/components/game/RoundTwoGame.tsx", "utf8");
const rendererBlock = roundTwo.slice(roundTwo.indexOf("const RENDERERS"));
const clientIds = new Set([
  ...[...gamePage.matchAll(/room\.gameId === "([^"]+)"/g)].map((match) => match[1]),
  ...[...rendererBlock.matchAll(/^\s{2}(?:"([^"]+)"|([a-z][a-z0-9-]*)):\s*[A-Z]/gm)].map(
    (match) => match[1] || match[2],
  ),
]);



const testFiles = (await readdir("src/server/test"))
  .filter((file) => file.endsWith(".test.js"))
  .map((file) => path.join("src/server/test", file));
const testText = (
  await Promise.all(testFiles.map((file) => readFile(file, "utf8")))
).join("\n");

const consumed = {
  "buzzer-trivia": 10,
  "fact-or-fiction": 30,
  codenames: 25,
  "fill-the-blank-prompts": 10,
  "fill-the-blank-answers": 70,
};
function launchMin(id) {
  const rounds = consumed[id] || 10;
  return Math.min(400, Math.max(150, rounds * 10));
}

const extraGames = [
  ["closest-wins", "Closest Wins"],
  ["timeline", "Timeline"],
  ["rank-it", "Rank It"],
  ["emoji-decode", "Emoji Decode"],
  ["flag", "Flag Rush"],
  ["chameleon", "Chameleon"],
  ["spyfall", "Spyfall"],
  ["just-one", "Just One"],
  ["type-race", "Type Race"],
  ["wordle-race", "Wordle Race"],
  ["bomb-party", "Bomb Party"],
  ["word-chain", "Word Chain"],
  ["hot-potato", "Hot Potato"],
  ["the-mind", "The Mind"],
  ["werewolf", "Werewolf"],
  ["resistance-lite", "Resistance-lite"],
  ["split-or-steal", "Split or Steal"],
  ["auction-bluff", "Auction Bluff"],
];

const rows = [];
for (const id of registryIds) {
  const status = bankStatus(id);
  const camel = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const hasTests =
    testText.includes(`"${id}"`) ||
    testText.includes(`/${id}`) ||
    testText.includes(`/games/${camel}.js`);
  const hasClient = clientIds.has(id);
  const size = status.required ? status.size : null;
  const launch = status.required ? launchMin(id) : null;
  const bankReady = !status.required || size >= launch;
  const mark =
    hasTests && hasClient && bankReady ? "BUILT" : "PARTIAL";
  rows.push({
    id,
    name: registry.get(id)?.name || id,
    registered: "yes",
    engine: "yes",
    client: hasClient ? "yes" : "no",
    bank: size === null ? "n/a" : String(size),
    launch: launch === null ? "n/a" : String(launch),
    tests: hasTests ? "yes" : "no",
    enabled: status.playable ? "yes" : "no",
    mark,
  });
}

for (const [id, name] of extraGames) {
  rows.push({
    id,
    name,
    registered: "no",
    engine: "no",
    client: "no",
    bank: "0",
    launch: String(launchMin(id)),
    tests: "no",
    enabled: "no",
    mark: "MISSING",
  });
}

function hasTestFor(id) {
  const camel = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  return (
    testText.includes(`"${id}"`) ||
    testText.includes(`/${id}`) ||
    testText.includes(`/games/${camel}.js`)
  );
}

const cardRows = [
  {
    id: "cards",
    name: "Deck primitive",
    engine: /standardDeck|buildDeck/.test(await readFile("src/server/games/cards.js", "utf8"))
      ? "yes"
      : "no",
    client: "yes",
    tests: testText.includes("cards") ? "yes" : "no",
  },
  {
    id: "liars-bar",
    name: "Liars Bar conversion",
    engine: "yes",
    client: clientIds.has("liars-bar") ? "yes" : "no",
    tests: hasTestFor("liars-bar") ? "yes" : "no",
  },
  {
    id: "fill-the-blank",
    name: "Fill the Blank card polish",
    engine: "yes",
    client: clientIds.has("fill-the-blank") ? "yes" : "no",
    tests: hasTestFor("fill-the-blank") ? "yes" : "no",
  },
  {
    id: "higher-or-lower",
    name: "Higher/Lower Deck mode",
    engine: /deck:\s*\{/.test(await readFile("src/server/games/higherLower.js", "utf8"))
      ? "yes"
      : "no",
    client: clientIds.has("higher-or-lower") ? "yes" : "no",
    tests: hasTestFor("higher-or-lower") ? "yes" : "no",
  },
  {
    id: "cheat",
    name: "Cheat",
    engine: "yes",
    client: clientIds.has("cheat") ? "yes" : "no",
    tests: hasTestFor("cheat") ? "yes" : "no",
  },
  {
    id: "skull-duel",
    name: "Skull Duel",
    engine: "yes",
    client: clientIds.has("skull-duel") ? "yes" : "no",
    tests: hasTestFor("skull-duel") ? "yes" : "no",
  },
  {
    id: "blackjack-showdown",
    name: "Blackjack Showdown",
    engine: "yes",
    client: clientIds.has("blackjack-showdown") ? "yes" : "no",
    tests: hasTestFor("blackjack-showdown") ? "yes" : "no",
  },
];
for (const item of cardRows) {
  const built = [item.engine, item.client, item.tests].every((value) => value === "yes");
  rows.push({
    ...item,
    registered: "card",
    bank: "n/a",
    launch: "n/a",
    enabled: item.client === "yes" ? "yes" : "no",
    mark: built ? "BUILT" : "PARTIAL",
  });
}

const header = [
  "# Game status audit",
  "",
  "Generated by `scripts/status-audit.mjs` from the registry, engine files, client routing, tests and loaded banks.",
  "`MODES.md` is not present in this checkout; the MODES.md-only rows below come from the game names named in the execution brief and the bank targets already tracked in the repository.",
  "",
  "| Game | id | Registered | Engine | Client | Bank | Launch min | Tests | Enabled | Status |",
  "| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- |",
];
const lines = rows.map(
  (row) =>
    `| ${row.name} | \`${row.id}\` | ${row.registered} | ${row.engine} | ${row.client} | ${row.bank} | ${row.launch} | ${row.tests} | ${row.enabled} | **${row.mark}** |`,
);
const summary = [
  "",
  "## Summary",
  "",
  `- BUILT: ${rows.filter((row) => row.mark === "BUILT").length}`,
  `- PARTIAL: ${rows.filter((row) => row.mark === "PARTIAL").length}`,
  `- MISSING: ${rows.filter((row) => row.mark === "MISSING").length}`,
  "",
  "Launch minimum policy: consumed items per session × 10, floored at 150 and capped at 400. Long-term targets remain separate stretch goals.",
];
await writeFile("docs/STATUS.md", [...header, ...lines, ...summary].join("\n") + "\n");
console.log(`wrote docs/STATUS.md: ${rows.length} rows`);
