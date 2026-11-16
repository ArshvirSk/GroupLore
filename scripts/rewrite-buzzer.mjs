import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/server/data/prompts");
const read = async (file) => JSON.parse(await readFile(path.join(DIR, file), "utf8"));
const write = async (file, data) =>
  writeFile(path.join(DIR, file), `${JSON.stringify(data, null, 2)}\n`);

const facts = [
  ["Which planet is known as the Red Planet?", "Mars", "Science"],
  ["Which gas do plants absorb from the air for photosynthesis?", "Carbon dioxide", "Science"],
  ["Which ocean is the largest?", "Pacific", "Geography"],
  ["Which natural substance is the hardest?", "Diamond", "Science"],
  ["Which land animal is the largest?", "African elephant", "Animals"],
  ["How many continents are there?", "Seven", "Geography"],
  ["Which planet has the most confirmed moons?", "Saturn", "Science"],
  ["At sea level, what is water's boiling point in Celsius?", "100", "Science"],
  ["Which organ pumps blood around the body?", "Heart", "Science"],
  ["Which is the largest hot desert?", "Sahara", "Geography"],
  ["Which country is home to kangaroos?", "Australia", "Geography"],
  ["Which river runs through Egypt and Sudan?", "Nile", "Geography"],
  ["Which language has the most native speakers?", "Mandarin Chinese", "Geography"],
  ["Which planet is smallest?", "Mercury", "Science"],
  ["Which vitamin does sunlight help the skin produce?", "Vitamin D", "Science"],
  ["Which bird is the largest?", "Ostrich", "Animals"],
  ["Which metal is liquid at room temperature?", "Mercury", "Science"],
  ["How many sides does a hexagon have?", "Six", "Maths"],
  ["What is Japan's currency?", "Yen", "Geography"],
  ["Which country is credited with inventing paper?", "China", "History"],
  ["Which waterfall is the tallest?", "Angel Falls", "Geography"],
  ["Which blood type is the universal donor?", "O negative", "Science"],
  ["What is the chemical formula for table salt?", "NaCl", "Science"],
  ["Which planet is closest to the Sun?", "Mercury", "Science"],
  ["Which shark species is the largest?", "Whale shark", "Animals"],
  ["Which country contains the Eiffel Tower?", "France", "Geography"],
  ["Which body of water is famous for extreme salinity?", "Dead Sea", "Geography"],
  ["How many soccer players from one team are on the field?", "Eleven", "Sport"],
  ["Which instrument has 88 keys?", "Piano", "Music"],
  ["Which continent is the largest?", "Asia", "Geography"],
  ["Which animal is famous for changing colour?", "Chameleon", "Animals"],
  ["What is the study of stars called?", "Astronomy", "Science"],
  ["Which gas makes up most of Earth's atmosphere?", "Nitrogen", "Science"],
  ["Which internal organ is the largest?", "Liver", "Science"],
  ["Which country had the largest population in 2023?", "India", "Geography"],
  ["What is the United Kingdom's currency?", "Pound sterling", "Geography"],
  ["Which planet is famous for its rings?", "Saturn", "Science"],
  ["Which bone in the human body is smallest?", "Stapes", "Science"],
  ["Which mammal can fly?", "Bat", "Animals"],
  ["Which is the largest desert in Asia?", "Gobi", "Geography"],
  ["Which country contains the Great Barrier Reef?", "Australia", "Geography"],
  ["Which gas is the Sun mostly made of?", "Hydrogen", "Science"],
  ["Who painted the Mona Lisa?", "Leonardo da Vinci", "Art"],
  ["Who composed the Ninth Symphony?", "Beethoven", "Music"],
  ["Which human bone is the longest?", "Femur", "Science"],
  ["Which element has atomic number 1?", "Hydrogen", "Science"],
  ["How many colours are in a rainbow?", "Seven", "Science"],
  ["Which country is shaped like a boot?", "Italy", "Geography"],
  ["Which island is the largest?", "Greenland", "Geography"],
  ["Which animal has the longest gestation?", "Elephant", "Animals"],
  ["Which land animal is fastest?", "Cheetah", "Animals"],
  ["Which planet is called the Evening Star?", "Venus", "Science"],
  ["Which lake has the largest surface area?", "Caspian Sea", "Geography"],
  ["Which season follows winter?", "Spring", "Science"],
  ["Which penguin species is the largest?", "Emperor penguin", "Animals"],
  ["Which country is famous for tulips and windmills?", "Netherlands", "Geography"],
  ["Which mineral is used in pencil leads?", "Graphite", "Science"],
  ["Which planet is the largest?", "Jupiter", "Science"],
  ["How many strings does a standard guitar have?", "Six", "Music"],
  ["Which ocean lies between Africa and Australia?", "Indian Ocean", "Geography"],
  ["Which country is smallest by area?", "Vatican City", "Geography"],
  ["Who wrote Romeo and Juliet?", "Shakespeare", "Literature"],
  ["Which flower is the largest?", "Rafflesia", "Science"],
  ["Which gas do humans need to breathe?", "Oxygen", "Science"],
  ["Which continent contains the Sahara?", "Africa", "Geography"],
  ["Which mammal is the largest?", "Blue whale", "Animals"],
  ["Which planet's day is longer than its year?", "Venus", "Science"],
  ["Which metal is most abundant in Earth's crust?", "Aluminium", "Science"],
  ["Which fish is the fastest?", "Sailfish", "Animals"],
  ["Which bear species is generally the largest?", "Polar bear", "Animals"],
  ["Which country hosted the 2016 Summer Olympics?", "Brazil", "Sport"],
  ["What is guacamole's main ingredient?", "Avocado", "Food"],
  ["Which planet is farthest from the Sun?", "Neptune", "Science"],
  ["Which big cat species is the largest?", "Tiger", "Animals"],
  ["Which cell organelle is called the powerhouse?", "Mitochondria", "Science"],
  ["Which force keeps planets in orbit?", "Gravity", "Science"],
  ["What is the approximate speed of light?", "300,000 km/s", "Science"],
  ["What is the centre of an atom called?", "Nucleus", "Science"],
  ["Which process do plants use to make food?", "Photosynthesis", "Science"],
  ["Which state of matter is most common in the universe?", "Plasma", "Science"],
  ["Which particle has a negative charge?", "Electron", "Science"],
  ["What is the SI unit of force?", "Newton", "Science"],
  ["What is the SI unit of energy?", "Joule", "Science"],
  ["What is the study of living things called?", "Biology", "Science"],
  ["Which organ is the human body's largest?", "Skin", "Science"],
  ["How many bones are in an adult human body?", "206", "Science"],
  ["What is normal human body temperature in Celsius?", "37", "Science"],
  ["Which planet has the Great Red Spot?", "Jupiter", "Science"],
  ["What is a pattern of stars called?", "Constellation", "Science"],
  ["What is water turning into vapour called?", "Evaporation", "Science"],
  ["Which star is closest to Earth?", "Sun", "Science"],
  ["What is our galaxy called?", "Milky Way", "Science"],
  ["Which layer of Earth do we live on?", "Crust", "Science"],
  ["What mainly causes ocean tides?", "Moon's gravity", "Science"],
  ["What is the smallest unit of an element?", "Atom", "Science"],
  ["What is the chemical process that rusts iron?", "Oxidation", "Science"],
  ["What is the SI unit of electric current?", "Ampere", "Science"],
  ["What is the study of weather called?", "Meteorology", "Science"],
  ["Which is Jupiter's largest moon?", "Ganymede", "Science"],
  ["What is Earth's main source of energy?", "Sun", "Science"],
  ["What are plant-eating animals called?", "Herbivores", "Science"],
  ["What is ordinary cell division called?", "Mitosis", "Science"],
  ["What is the pH of pure water?", "7", "Science"],
  ["Which planet is fourth from the Sun?", "Mars", "Science"],
  ["Which rodent is the largest?", "Capybara", "Animals"],
  ["Which dolphin species is the largest?", "Orca", "Animals"],
  ["At what Celsius temperature does water freeze?", "0", "Science"],
  ["How many basketball players from one team start on court?", "Five", "Sport"],
  ["What is the sum of a triangle's interior angles?", "180 degrees", "Maths"],
];

const trivia = await read("buzzerTrivia.json");
const items = Array.isArray(trivia) ? trivia : trivia.questions;
const capitalItems = items.filter((item) => /\bcapital\b/i.test(item.text));
const symbolItems = items.filter((item) => /chemical symbol/i.test(item.text));
const largestItems = items.filter((item) => /^what is the largest/i.test(item.text));
const countItems = items.filter(
  (item) => /^how many\b/i.test(item.text) && !capitalItems.includes(item) && !symbolItems.includes(item),
);
const targets = [
  ...capitalItems.slice(0, 74),
  ...symbolItems.slice(0, 30),
  ...largestItems.slice(0, 2),
  ...countItems.slice(0, 3),
];
if (targets.length !== facts.length) {
  throw new Error(`expected ${facts.length} slots, found ${targets.length}`);
}
for (let index = 0; index < targets.length; index += 1) {
  const [text, answer, category] = facts[index];
  const item = targets[index];
  item.text = text;
  item.answer = answer;
  item.aliases = [answer.toLowerCase()];
  item.category = category;
}
await write("buzzerTrivia.json", trivia);

const factBank = await read("factOrFiction.json");
const factItems = Array.isArray(factBank) ? factBank : factBank.items;
const capitalFacts = factItems.filter((item) => /\bcapital\b/i.test(item.text)).slice(0, 12);
const pairs = [
  ["The Nile is the longest river in Africa.", true, "The Nile runs through northeastern Africa."],
  ["The Amazon is the longest river in Africa.", false, "The Amazon is in South America."],
  ["Mount Everest is the tallest mountain above sea level.", true, "Everest's summit is the highest above sea level."],
  ["K2 is the tallest mountain above sea level.", false, "K2 is the second-highest mountain above sea level."],
  ["The Pacific is the largest ocean.", true, "The Pacific covers more area than any other ocean."],
  ["The Atlantic is the largest ocean.", false, "The Pacific is larger than the Atlantic."],
  ["The Sahara is the largest hot desert.", true, "The Sahara is the largest hot desert."],
  ["The Gobi is the largest hot desert.", false, "The Sahara is larger; the Gobi is a cold desert."],
  ["Japan is an island nation.", true, "Japan consists of thousands of islands."],
  ["Japan is landlocked.", false, "Japan is surrounded by the sea."],
  ["Penguins live in the Southern Hemisphere.", true, "Wild penguins are found mainly in the Southern Hemisphere."],
  ["Penguins live around the North Pole.", false, "There are no wild penguins around the North Pole."],
];
for (let index = 0; index < capitalFacts.length; index += 1) {
  const [text, isTrue, explanation] = pairs[index];
  Object.assign(capitalFacts[index], {
    text,
    isTrue,
    explanation,
    tags: ["geography"],
    rating: "all",
  });
}
await write("factOrFiction.json", factBank);

console.log("buzzer replacements", targets.length, "fact replacements", capitalFacts.length);
