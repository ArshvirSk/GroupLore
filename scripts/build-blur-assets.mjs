import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public", "blur");
const manifestDir = path.join(root, "src", "server", "data", "assets", "blur");

const subjects = [
  {
    id: "sun",
    answer: "Sun",
    aliases: ["the sun", "sunshine"],
    category: "nature",
    art: '<circle cx="200" cy="150" r="58" fill="#FFC93C"/><g stroke="#FF9F1C" stroke-width="12" stroke-linecap="round"><path d="M200 48v-24M200 276v-24M98 150H74M326 150h-24M128 78l-17-17M289 239l-17-17M272 78l17-17M111 239l17-17"/></g>',
  },
  {
    id: "moon",
    answer: "Moon",
    aliases: ["the moon", "crescent moon"],
    category: "nature",
    art: '<path d="M250 55a105 105 0 1 0 80 172 88 88 0 0 1-80-172Z" fill="#F4E9C8"/><circle cx="150" cy="96" r="5" fill="#fff"/><circle cx="245" cy="220" r="4" fill="#fff"/><circle cx="110" cy="190" r="3" fill="#fff"/>',
  },
  {
    id: "star",
    answer: "Star",
    aliases: ["a star"],
    category: "space",
    art: '<path d="m200 38 35 73 80 11-58 56 14 80-71-38-71 38 14-80-58-56 80-11z" fill="#FFD166" stroke="#F4A261" stroke-width="8"/>',
  },
  {
    id: "tree",
    answer: "Tree",
    aliases: ["a tree"],
    category: "nature",
    art: '<rect x="185" y="175" width="30" height="110" rx="8" fill="#8D5A3B"/><circle cx="200" cy="140" r="78" fill="#43AA8B"/><circle cx="145" cy="170" r="52" fill="#4CC9A2"/><circle cx="255" cy="170" r="52" fill="#2F9E75"/>',
  },
  {
    id: "house",
    answer: "House",
    aliases: ["home", "a house"],
    category: "places",
    art: '<rect x="105" y="150" width="190" height="120" fill="#F4F1DE" stroke="#7F5539" stroke-width="8"/><path d="M85 155 200 60l115 95" fill="#E76F51" stroke="#7F5539" stroke-width="8"/><rect x="175" y="200" width="50" height="70" fill="#7F5539"/><rect x="125" y="175" width="35" height="35" fill="#8ECAE6"/>',
  },
  {
    id: "fish",
    answer: "Fish",
    aliases: ["a fish"],
    category: "animals",
    art: '<ellipse cx="195" cy="155" rx="110" ry="62" fill="#FF8A00"/><path d="M300 155l70-50v100z" fill="#FFB703"/><circle cx="135" cy="138" r="9" fill="#23182F"/><path d="M170 190c20 28 55 30 80 8" fill="none" stroke="#fff" stroke-width="7"/>',
  },
  {
    id: "boat",
    answer: "Boat",
    aliases: ["sailboat", "ship"],
    category: "travel",
    art: '<path d="M100 215h200l-35 55H135z" fill="#7F5539"/><path d="M200 55v155" stroke="#5C4033" stroke-width="10"/><path d="M200 65l95 130H200z" fill="#F4F1DE"/><path d="M190 90 110 195h80z" fill="#E76F51"/><path d="M70 285c30-18 60 18 90 0s60 18 90 0 60 18 90 0" fill="none" stroke="#219EBC" stroke-width="8"/>',
  },
  {
    id: "umbrella",
    answer: "Umbrella",
    aliases: ["parasol"],
    category: "objects",
    art: '<path d="M80 170a120 120 0 0 1 240 0z" fill="#FF5C8A"/><path d="M200 50v190a40 40 0 0 0 80 0" fill="none" stroke="#5C4033" stroke-width="12"/><path d="M200 50v120" stroke="#5C4033" stroke-width="8"/>',
  },
  {
    id: "apple",
    answer: "Apple",
    aliases: ["an apple"],
    category: "food",
    art: '<circle cx="175" cy="170" r="78" fill="#E63946"/><circle cx="235" cy="170" r="68" fill="#D62839"/><path d="M205 95c12-28 38-38 55-38-4 30-22 48-48 52" fill="#2A9D8F"/><path d="M202 95c-8-20-4-38 4-50" stroke="#7F5539" stroke-width="10" fill="none"/>',
  },
  {
    id: "rocket",
    answer: "Rocket",
    aliases: ["spaceship", "space rocket"],
    category: "space",
    art: '<path d="M200 45c58 45 70 100 42 165h-84c-28-65-16-120 42-165Z" fill="#F4F1DE" stroke="#5C4033" stroke-width="8"/><circle cx="200" cy="145" r="28" fill="#8ECAE6" stroke="#5C4033" stroke-width="8"/><path d="m158 190-45 55 48-8m81 8 45 55-48-8" fill="#E76F51"/><path d="M170 215c8 35 22 55 30 65 8-10 22-30 30-65z" fill="#FFB703"/>',
  },
  {
    id: "clock",
    answer: "Clock",
    aliases: ["wall clock", "timer"],
    category: "objects",
    art: '<circle cx="200" cy="160" r="105" fill="#F4F1DE" stroke="#5C4033" stroke-width="12"/><circle cx="200" cy="160" r="8" fill="#5C4033"/><path d="M200 160V95M200 160l48 35" stroke="#23182F" stroke-width="10" stroke-linecap="round"/><path d="M200 55v18M200 247v18M95 160h18M287 160h18" stroke="#5C4033" stroke-width="8"/>',
  },
  {
    id: "cat",
    answer: "Cat",
    aliases: ["kitten", "a cat"],
    category: "animals",
    art: '<path d="M120 90 145 35l52 42h6l52-42 25 55" fill="#F4A261" stroke="#5C4033" stroke-width="8"/><circle cx="200" cy="175" r="85" fill="#F4A261"/><circle cx="170" cy="160" r="8" fill="#23182F"/><circle cx="230" cy="160" r="8" fill="#23182F"/><path d="M185 190h30l-15 13z" fill="#FF5C8A"/><path d="M200 203c-10 18-28 18-40 8M200 203c10 18 28 18 40 8" fill="none" stroke="#5C4033" stroke-width="5"/><path d="M125 190H75M130 210H85M275 190h50M270 210h45" stroke="#5C4033" stroke-width="5"/>',
  },
  {
    id: "mushroom",
    answer: "Mushroom",
    aliases: ["toadstool"],
    category: "nature",
    art: '<path d="M95 165a105 70 0 0 1 210 0z" fill="#E63946"/><path d="M175 165h50v95c0 20-50 20-50 0z" fill="#F4F1DE"/><circle cx="155" cy="135" r="13" fill="#fff"/><circle cx="235" cy="125" r="10" fill="#fff"/><circle cx="200" cy="155" r="8" fill="#fff"/>',
  },
  {
    id: "key",
    answer: "Key",
    aliases: ["a key"],
    category: "objects",
    art: '<circle cx="125" cy="160" r="55" fill="none" stroke="#FFB703" stroke-width="24"/><path d="M170 160h145v30h-35v30h-30v-30h-25v30h-30v-30h-25" fill="#FFB703"/>',
  },
];

const WIDTH = 400;
const HEIGHT = 300;
const stages = 6;

await mkdir(publicDir, { recursive: true });
await mkdir(manifestDir, { recursive: true });

const manifest = [];
for (const subject of subjects) {
  const ids = [];
  for (let stage = 1; stage <= stages; stage += 1) {
    const blur = 30 - (stage - 1) * 5.4;
    const file = `${subject.id}-${stage}.svg`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><filter id="blur"><feGaussianBlur stdDeviation="${blur.toFixed(1)}"/></filter></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#F7F2E8"/>
  <g filter="url(#blur)">${subject.art}</g>
</svg>
`;
    await writeFile(path.join(publicDir, file), svg);
    ids.push(`/blur/${file}`);
  }
  const sharp = `${subject.id}.svg`;
  await writeFile(
    path.join(publicDir, sharp),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#F7F2E8"/>${subject.art}</svg>\n`,
  );
  manifest.push({
    id: `blur-${subject.id}`,
    answer: subject.answer,
    aliases: subject.aliases,
    category: subject.category,
    stages: ids,
    sharp: `/blur/${sharp}`,
    license: "self-made",
    source: "scripts/build-blur-assets.mjs",
  });
}

await writeFile(
  path.join(manifestDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Generated ${manifest.length} subjects with ${stages} blur stages each.`);
