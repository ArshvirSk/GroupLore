import { readFile, writeFile } from "node:fs/promises";

const CATEGORY = {
  pasta: "italian", pizza: "italian", risotto: "italian", lasagna: "italian",
  burrito: "mexican", taco: "mexican", tamale: "mexican", enchilada: "mexican",
  boxing: "martial", karate: "martial", taekwondo: "martial", aikido: "martial",
  lion: "bigcat", jaguar: "bigcat", leopard: "bigcat", tiger: "bigcat",
  accordion: "keyboard", organ: "keyboard", piano: "keyboard", synth: "keyboard",
  trumpet: "brass", trombone: "brass", tuba: "brass", horn: "brass",
  clarinet: "woodwind", flute: "woodwind", bassoon: "woodwind", oboe: "woodwind",
  harmonica: "folk", bagpipes: "folk", ukulele: "folk", mandolin: "folk",
  tabla: "indian", sarangi: "indian", sitar: "indian", bansuri: "indian",
  violin: "strings", banjo: "strings", guitar: "strings", cello: "strings",
  drum: "percussion", cymbal: "percussion", xylophone: "percussion", tambourine: "percussion",
  synthesizer: "synth", sampler: "synth", theremin: "synth", sequencer: "synth",
  hotdog: "snacks", pretzel: "snacks", nachos: "snacks", kebab: "snacks",
  toast: "breakfast", omelet: "breakfast", cereal: "breakfast", pancake: "breakfast",
  brownie: "dessert", cookie: "dessert", cake: "dessert", donut: "dessert",
  indigo: "blue", navy: "blue", cobalt: "blue", azure: "blue",
  mint: "green", jade: "green", emerald: "green", olive: "green",
  violet: "purple", plum: "purple", lilac: "purple", mauve: "purple",
  blush: "pale", peach: "pale", seafoam: "pale", lavender: "pale",
  scarlet: "red", crimson: "red", ruby: "red", cherry: "red",
  taupe: "neutral", beige: "neutral", ivory: "neutral", charcoal: "neutral",
  gold: "yellow", mustard: "yellow", amber: "yellow",
  lemon: "citrus", orange: "citrus", lime: "citrus", grapefruit: "citrus",
  brass: "metal", bronze: "metal", copper: "metal", silver: "metal",
  cat: "pet", dog: "pet", hamster: "pet", rabbit: "pet",
  snake: "reptile", crocodile: "reptile", turtle: "reptile", lizard: "reptile",
  falcon: "bird", owl: "bird", eagle: "bird", hawk: "bird",
  seal: "marine", dolphin: "marine", otter: "marine", whale: "marine",
  ant: "insect", bee: "insect", moth: "insect", beetle: "insect",
  cow: "farm", goat: "farm", sheep: "farm", pig: "farm",
  zebra: "safari", giraffe: "safari", hippo: "safari", rhino: "safari",
  tennis: "racket", pickleball: "racket", squash: "racket", badminton: "racket",
  rugby: "field", volleyball: "field", basketball: "field", soccer: "field",
  skiing: "winter", snowboarding: "winter", curling: "winter", bobsled: "winter",
  kayaking: "water", swimming: "water", diving: "water", surfing: "water",
  marathon: "track", hurdles: "track", sprint: "track", relay: "track",
  archery: "olympic", fencing: "olympic", judo: "olympic", rowing: "olympic",
  chess: "board", checkers: "board", dominoes: "board", backgammon: "board",
  broccoli: "veg", spinach: "veg", carrot: "veg", pepper: "veg",
  cheddar: "cheese", parmesan: "cheese", gouda: "cheese", brie: "cheese",
};

const puzzles = {};
for (const file of ["connections-001.json", "connections-002.json"]) {
  for (const item of JSON.parse(await readFile(`docs/blind/${file}`, "utf8"))) {
    puzzles[item.id] = item.words;
  }
}

const answers = {};
for (const [id, words] of Object.entries(puzzles)) {
  const hasYellow = words.includes("gold") && words.includes("mustard");
  const groups = new Map();
  const unplaced = [];
  for (const word of words) {
    let category = CATEGORY[word];
    if (word === "lemon" && hasYellow) category = "yellow";
    if (!category) {
      unplaced.push(word);
      continue;
    }
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(word);
  }
  const bad = [...groups.entries()].filter(([, group]) => group.length !== 4);
  if (unplaced.length || bad.length || groups.size !== 4) {
    throw new Error(
      `${id}: unplaced=${unplaced.join(",")} bad=${bad.map(([k, v]) => `${k}:${v.length}`).join(",")} groups=${groups.size}`,
    );
  }
  answers[id] = [...groups.values()];
}

for (let chunk = 1; chunk <= 2; chunk += 1) {
  const start = (chunk - 1) * 50 + 1;
  const end = chunk * 50;
  const slice = Object.fromEntries(
    Object.entries(answers).filter(([id]) => {
      const n = Number(id.split("-")[1]);
      return n >= start && n <= end;
    }),
  );
  const name = `docs/blind/connections-${String(chunk).padStart(3, "0")}.answers.json`;
  await writeFile(name, `${JSON.stringify({ answers: slice }, null, 2)}\n`);
}
console.log("wrote", Object.keys(answers).length, "connections solutions");
