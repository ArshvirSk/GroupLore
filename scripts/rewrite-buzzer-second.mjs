import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "src/server/data/prompts");
const read = async (file) => JSON.parse(await readFile(path.join(DIR, file), "utf8"));
const write = async (file, data) =>
  writeFile(path.join(DIR, file), `${JSON.stringify(data, null, 2)}\n`);

const facts = [
  ["Which animal builds dams?", "Beaver", "Animals"],
  ["What pigment makes leaves green?", "Chlorophyll", "Science"],
  ["Which planet rotates on its side?", "Uranus", "Science"],
  ["Which scientist developed general relativity?", "Albert Einstein", "Science"],
  ["Which gas do humans exhale?", "Carbon dioxide", "Science"],
  ["Which sea separates Europe and Africa?", "Mediterranean Sea", "Geography"],
  ["Which country gave the United States the Statue of Liberty?", "France", "History"],
  ["What is hummus made from?", "Chickpeas", "Food"],
  ["In which sport is a shuttlecock used?", "Badminton", "Sport"],
  ["Which metal is widely used in electrical wiring?", "Copper", "Science"],
  ["Which animal is known for a pouch?", "Kangaroo", "Animals"],
  ["Which planet has a moon called Titan?", "Saturn", "Science"],
  ["What is chocolate made from?", "Cacao", "Food"],
  ["Which country is famous for sushi?", "Japan", "Food"],
  ["Which organs filter blood?", "Kidneys", "Science"],
  ["What is a baby cat called?", "Kitten", "Animals"],
  ["Which instrument is played with a bow?", "Violin", "Music"],
  ["What is India's currency?", "Rupee", "Geography"],
  ["Which continent is Brazil in?", "South America", "Geography"],
  ["Which gas makes a balloon float?", "Helium", "Science"],
  ["Which animal has a trunk?", "Elephant", "Animals"],
  ["What is the study of earthquakes called?", "Seismology", "Science"],
  ["Which vitamin is found in citrus fruit?", "Vitamin C", "Science"],
  ["What is a group of lions called?", "Pride", "Animals"],
  ["Which country contains Machu Picchu?", "Peru", "Geography"],
  ["What is bread mainly made from?", "Flour", "Food"],
  ["Which planet lies between Earth and Saturn?", "Jupiter", "Science"],
  ["What is a young dog called?", "Puppy", "Animals"],
  ["Which sea lies between Italy and the Balkans?", "Adriatic Sea", "Geography"],
  ["What is Canada's currency?", "Canadian dollar", "Geography"],
  ["Which animal is the symbol of the WWF?", "Giant panda", "Animals"],
  ["What is a caterpillar's transformation into a butterfly called?", "Metamorphosis", "Science"],
  ["Which country contains the Taj Mahal?", "India", "Geography"],
  ["What is pesto mainly made from?", "Basil", "Food"],
  ["Which gas is used in neon signs?", "Neon", "Science"],
  ["Which body system includes the heart?", "Circulatory system", "Science"],
  ["Which country is famous for the tango?", "Argentina", "Music"],
  ["Which animal is known for its laughing call?", "Hyena", "Animals"],
  ["Which fruit is long and yellow?", "Banana", "Food"],
  ["Which country contains Marrakech?", "Morocco", "Geography"],
  ["What is frozen water called?", "Ice", "Science"],
  ["Which organ produces insulin?", "Pancreas", "Science"],
  ["Which sport is played at Lord's?", "Cricket", "Sport"],
  ["Which country is the home of the Maori?", "New Zealand", "Geography"],
  ["What is ketchup mainly made from?", "Tomato", "Food"],
  ["Which star sign begins in late March?", "Aries", "Science"],
  ["Which country is the home of pasta?", "Italy", "Food"],
  ["What is a group of fish called?", "School", "Animals"],
  ["Which metal is commonly used in drink cans?", "Aluminium", "Science"],
  ["Which country is the home of the kilt?", "Scotland", "Geography"],
  ["Which fruit is used to make wine?", "Grapes", "Food"],
];

const trivia = await read("buzzerTrivia.json");
const items = Array.isArray(trivia) ? trivia : trivia.questions;
const byText = new Map();
for (const item of items) {
  if (!byText.has(item.text)) byText.set(item.text, []);
  byText.get(item.text).push(item);
}
const targets = new Set();
for (const group of byText.values()) {
  for (const item of group.slice(1)) targets.add(item.id);
}
const capitals = items.filter((item) => /\bcapital\b/i.test(item.text));
const symbols = items.filter((item) => /chemical symbol/i.test(item.text));
for (const item of capitals.slice(9)) targets.add(item.id);
for (const item of symbols.slice(9)) targets.add(item.id);
const targetItems = items.filter((item) => targets.has(item.id));
if (targetItems.length !== facts.length) {
  throw new Error(`expected ${facts.length} targets, found ${targetItems.length}`);
}
for (let index = 0; index < targetItems.length; index += 1) {
  const [text, answer, category] = facts[index];
  const item = targetItems[index];
  item.text = text;
  item.answer = answer;
  item.aliases = [answer.toLowerCase()];
  item.category = category;
}
await write("buzzerTrivia.json", trivia);

const factBank = await read("factOrFiction.json");
const factItems = Array.isArray(factBank) ? factBank : factBank.items;
for (const item of factItems) {
  if (item.id === "ff-045") {
    item.text = "The Great Wall of China is in China.";
    item.isTrue = true;
    item.explanation = "The Great Wall is a series of fortifications in northern China.";
  }
  if (item.id === "ff-046") {
    item.text = "The Great Wall of China is in Japan.";
    item.isTrue = false;
    item.explanation = "The Great Wall is in China, not Japan.";
  }
}
await write("factOrFiction.json", factBank);
console.log("second buzzer replacements", targetItems.length);
