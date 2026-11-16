import { readFile, writeFile } from "node:fs/promises";

const file = "src/server/data/prompts/factOrFiction.json";
const data = JSON.parse(await readFile(file, "utf8"));
const pairs = [
  ["Honey can stay edible for a very long time.", true, "Sealed honey resists spoiling because of its low water content and acidity."],
  ["Honey spoils within a week.", false, "Honey is famously long-lasting when stored sealed."],
  ["Octopuses have three hearts.", true, "Two pump blood to the gills and one to the rest of the body."],
  ["Octopuses have one heart.", false, "Octopuses have three hearts."],
  ["Bananas are botanically berries.", true, "A banana develops from a flower with one ovary and has seeds."],
  ["Bananas are botanically nuts.", false, "Bananas are berries, not nuts."],
  ["Sound travels faster in water than in air.", true, "Water is denser and carries sound faster than air."],
  ["Sound travels slower in water than in air.", false, "Sound travels faster through water."],
  ["A lightning bolt is hotter than the Sun's surface.", true, "Lightning can briefly reach about 30,000 K."],
  ["A lightning bolt is cooler than the Sun's surface.", false, "Lightning is much hotter than the Sun's visible surface."],
  ["Venus is hotter than Mercury.", true, "Venus's thick greenhouse atmosphere makes it hotter."],
  ["Mercury is hotter than Venus.", false, "Venus has the hotter surface."],
  ["Sharks have no bones.", true, "Their skeletons are made of cartilage."],
  ["Sharks have bony skeletons.", false, "Shark skeletons are cartilage."],
  ["The Moon has essentially no atmosphere.", true, "The Moon has only an extremely thin exosphere."],
  ["The Moon has a thick atmosphere.", false, "The Moon has essentially no atmosphere."],
  ["Mars has two moons.", true, "Phobos and Deimos are Mars's two moons."],
  ["Mars has three moons.", false, "Mars has two known moons."],
  ["Antarctica is a desert.", true, "It receives very little precipitation."],
  ["Antarctica is a rainforest.", false, "Antarctica is a cold desert."],
  ["Gold is denser than iron.", true, "Gold has a much higher density than iron."],
  ["Iron is denser than gold.", false, "Gold is denser than iron."],
  ["A day on Venus lasts longer than its year.", true, "Venus rotates more slowly than it orbits the Sun."],
  ["A year on Venus lasts longer than its day.", false, "Venus's day is longer than its year."],
  ["Earth's core is mostly iron.", true, "The core is dominated by iron and nickel."],
  ["Earth's core is mostly oxygen.", false, "The core is mostly iron and nickel."],
  ["An adult human usually has 206 bones.", true, "The adult skeleton normally has 206 bones."],
  ["An adult human usually has 300 bones.", false, "Babies have more bones, but adults usually have 206."],
  ["Sound cannot travel through a vacuum.", true, "Sound needs a medium to carry vibrations."],
  ["Sound can travel through a vacuum.", false, "There is no medium for sound in a vacuum."],
  ["Mercury is the closest planet to the Sun.", true, "Mercury has the innermost orbit."],
  ["Venus is the closest planet to the Sun.", false, "Mercury is closer to the Sun."],
  ["Jupiter is larger than Saturn.", true, "Jupiter has the greater diameter and mass."],
  ["Saturn is larger than Jupiter.", false, "Jupiter is larger than Saturn."],
  ["A leap year has 366 days.", true, "Leap years add February 29."],
  ["A leap year has 365 days.", false, "A leap year has 366 days."],
  ["The Great Barrier Reef is off Australia.", true, "It lies in the Coral Sea off Queensland."],
  ["The Great Barrier Reef is off Brazil.", false, "It is off Australia."],
  ["The Sahara is in Africa.", true, "The Sahara spans northern Africa."],
  ["The Sahara is in Asia.", false, "The Sahara is in Africa."],
  ["The Amazon rainforest is mostly in South America.", true, "Most of it lies in Brazil and neighbouring countries."],
  ["The Amazon rainforest is mostly in Africa.", false, "The Amazon is in South America."],
  ["Mount Everest is in the Himalayas.", true, "Everest lies in the Himalayan range."],
  ["Mount Everest is in the Andes.", false, "Everest is in the Himalayas."],
  ["The Dead Sea is extremely salty.", true, "Its salinity is much higher than ordinary seawater."],
  ["The Dead Sea is a freshwater lake.", false, "The Dead Sea is extremely salty."],
  ["Bats are mammals.", true, "Bats have fur and produce milk."],
  ["Bats are birds.", false, "Bats are mammals."],
  ["Whales are fish.", false, "Whales are mammals."],
  ["Whales are mammals.", true, "Whales breathe air and nurse their young."],
];
let next = 301;
for (const [text, isTrue, explanation] of pairs) {
  data.push({
    id: `ff-${String(next).padStart(3, "0")}`,
    text,
    isTrue,
    explanation,
    tags: ["science", "nature"],
    rating: "all",
    confidence: "high",
  });
  next += 1;
}
await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
console.log("added", pairs.length, "total", data.length);
