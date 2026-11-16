import { readFile, writeFile } from "node:fs/promises";

const file = "src/server/data/prompts/buzzerTrivia.json";
const data = JSON.parse(await readFile(file, "utf8"));
const facts = [
  ["Which planet has the shortest day?", "Jupiter"],
  ["Which planet has the longest day?", "Venus"],
  ["What is Earth's natural satellite called?", "Moon"],
  ["What is the study of fossils called?", "Palaeontology"],
  ["Which gas dominates Venus's atmosphere?", "Carbon dioxide"],
  ["Which planet has the coldest average surface temperature?", "Neptune"],
  ["What is a group of wolves called?", "Pack"],
  ["What is a group of crows called?", "Murder"],
  ["What is a group of whales called?", "Pod"],
  ["Which animal can regrow its tail?", "Lizard"],
  ["What is a snake shedding its skin called?", "Moulting"],
  ["Which bird cannot fly?", "Penguin"],
  ["Which mammal lays eggs?", "Platypus"],
  ["Which animal has the strongest bite?", "Saltwater crocodile"],
  ["Which bird is fastest in a dive?", "Peregrine falcon"],
  ["Which insect produces silk?", "Silkworm"],
  ["What is the study of insects called?", "Entomology"],
  ["Which galaxy is nearest to the Milky Way?", "Andromeda"],
  ["What is a shooting star actually called?", "Meteor"],
  ["What is the boundary around a black hole called?", "Event horizon"],
  ["What force resists sliding motion?", "Friction"],
  ["What is the unit of frequency?", "Hertz"],
  ["What is the unit of power?", "Watt"],
  ["What is the unit of pressure?", "Pascal"],
  ["Which process powers the Sun?", "Nuclear fusion"],
  ["What speeds up a chemical reaction without being consumed?", "Catalyst"],
  ["What does the pH scale measure?", "Acidity"],
  ["Which blood vessels are the smallest?", "Capillaries"],
  ["Which artery is the largest in the body?", "Aorta"],
  ["What is the windpipe called?", "Trachea"],
  ["Which organ produces bile?", "Liver"],
  ["What is the voice box called?", "Larynx"],
  ["How many chambers does the human heart have?", "Four"],
  ["Which protein carries oxygen in red blood cells?", "Haemoglobin"],
  ["Which vitamin helps blood clot?", "Vitamin K"],
  ["Which mineral is important for strong bones?", "Calcium"],
  ["Which hormone triggers fight-or-flight?", "Adrenaline"],
  ["Which part of the brain is the largest?", "Cerebrum"],
  ["Which cells fight infection?", "White blood cells"],
  ["What is the clear liquid part of blood called?", "Plasma"],
  ["Which planet has Olympus Mons?", "Mars"],
  ["Which object is the largest in the asteroid belt?", "Ceres"],
  ["Which planet has the Great Dark Spot?", "Neptune"],
  ["What is a boundary between tectonic plates called?", "Fault"],
  ["What is molten rock below the surface called?", "Magma"],
  ["What is molten rock above the surface called?", "Lava"],
  ["What was the ancient supercontinent called?", "Pangaea"],
  ["What is the study of rocks called?", "Geology"],
  ["What scale measures mineral hardness?", "Mohs scale"],
  ["Which layer lies directly below Earth's crust?", "Mantle"],
];
let next = 301;
for (const [text, answer] of facts) {
  data.push({
    id: `buzz-${String(next).padStart(3, "0")}`,
    text,
    answer,
    aliases: [answer.toLowerCase()],
    category: "Science",
    difficulty: 2,
    tags: ["trivia", "science"],
    rating: "all",
  });
  next += 1;
}
await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
console.log("added", facts.length, "total", data.length);
