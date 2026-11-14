import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extraScatter,
  extraStoryStarters,
  extraSurvey,
  extraTrivia,
} from "./round2-extra-banks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "src", "server", "data");
const prompts = path.join(out, "prompts");

const fillPromptTemplates = [
  ["The worst thing to bring to {x}", ["a wedding", "a funeral", "a job interview", "a first date", "a family dinner", "a children's party", "a camping trip", "a book club", "a karaoke night", "a group project"]],
  ["The best thing to say after {x}", ["a long silence", "a bad joke", "an awkward toast", "a surprise party", "a failed magic trick", "a sports loss", "a haircut", "a broken promise", "a loud sneeze", "a group photo"]],
  ["A suspiciously specific birthday gift for {x}", ["a dentist", "a pirate", "a librarian", "a marathon runner", "a weather presenter", "a retired spy", "a wedding planner", "a night-shift nurse", "a wedding DJ", "a competitive baker"]],
  ["The new flavor at {x} that nobody asked for", ["an ice cream shop", "a coffee chain", "a pizza place", "a smoothie bar", "a bakery", "a cinema", "a theme park", "a gas station", "a cereal company", "a fancy restaurant"]],
  ["The worst superpower for {x}", ["a firefighter", "a teacher", "a surgeon", "a pilot", "a lifeguard", "a chef", "a security guard", "a therapist", "a tour guide", "a referee"]],
  ["The one rule every {x} should follow", ["book club", "road trip", "office kitchen", "group chat", "karaoke room", "shared apartment", "wedding speech", "board game night", "gym locker room", "family holiday"]],
  ["The worst thing to find in your {x}", ["shoe", "fridge", "backpack", "car", "bed", "pocket", "soup", "email inbox", "garage", "washing machine"]],
  ["The most dramatic way to announce {x}", ["a promotion", "a breakup", "a pregnancy", "a move abroad", "a new haircut", "a canceled flight", "a lost phone", "a surprise guest", "a failed exam", "a dinner reservation"]],
  ["A terrible theme for a {x} party", ["birthday", "retirement", "housewarming", "office", "new year", "baby shower", "engagement", "graduation", "halloween", "anniversary"]],
  ["The worst thing to whisper during {x}", ["a wedding ceremony", "a job interview", "a yoga class", "a horror film", "a first dance", "a dental exam", "a moment of silence", "a live podcast", "a job review", "a group photo"]],
  ["The most useless app for {x}", ["a marathon runner", "a sommelier", "a librarian", "a cat", "a submarine captain", "a wedding planner", "a night owl", "a gardener", "a pilot", "a toddler"]],
  ["The worst thing to bring to a {x} because ___", ["beach day", "job interview", "formal dinner", "camping trip", "first date", "funeral", "children's birthday", "movie night", "job site", "potluck"]],
];

const ftbPrompts = fillPromptTemplates.flatMap(([template, items], group) =>
  items.map((item, index) => ({
    id: `ftb-p-${String(group * 10 + index + 1).padStart(3, "0")}`,
    text: template.replace("{x}", item),
    blanks: (template.match(/___/g) || []).length,
    rating: "family",
  })),
);

const ftbNouns = [
  "pigeon", "toaster", "lighthouse", "pineapple", "sock puppet", "lawn flamingo",
  "submarine", "accordion", "wheelbarrow", "mannequin", "cactus", "blender",
  "typewriter", "hamster", "traffic cone", "umbrella", "grand piano", "washing machine",
  "rubber duck", "mailbox", "kettle", "ladder", "snow globe", "beeswax candle",
  "disco ball", "clothes hanger", "parking meter", "chessboard", "fire extinguisher",
  "hot-water bottle", "garden gnome", "stapler", "telescope", "picnic basket",
  "doorbell", "trampoline", "mug", "suitcase", "fishing rod", "alarm clock",
  "wind chime", "bread bin", "espresso machine", "hair dryer", "bicycle bell",
  "birdhouse", "postcard", "trophy", "watering can", "paperweight",
];
const ftbAdjectives = [
  "suspiciously confident", "aggressively beige", "slightly haunted", "deeply unqualified",
  "overly polished", "mildly explosive", "unnecessarily dramatic", "suspiciously damp",
  "professionally confused", "tragically underdressed",
];
const ftbClauses = [
  "makes eye contact for too long", "only speaks in riddles", "smells faintly of campfire",
  "has a very strong opinion about soup", "refuses to explain itself", "arrives with a lawyer",
  "insists it is a family heirloom", "vibrates when nervous", "knows too much about taxes",
  "has been banned from three weddings",
];

const ftbAnswers = [
  ...ftbNouns.slice(0, 25).flatMap((noun) =>
    ftbAdjectives.map((adjective) => `a ${adjective} ${noun}`),
  ),
  ...ftbNouns.slice(25).flatMap((noun) =>
    ftbClauses.map((clause) => `${noun} that ${clause}`),
  ),
].map((text, index) => ({
  id: `ftb-a-${String(index + 1).padStart(3, "0")}`,
  text,
  type: "answer",
}));

const connectionsFamilies = [
  {
    name: "color",
    groups: [
      ["Shades of red", ["crimson", "scarlet", "ruby", "cherry"]],
      ["Shades of blue", ["cobalt", "navy", "azure", "indigo"]],
      ["Shades of green", ["emerald", "olive", "mint", "jade"]],
      ["Shades of yellow", ["gold", "lemon", "mustard", "amber"]],
      ["Shades of purple", ["violet", "plum", "lilac", "mauve"]],
      ["Neutral tones", ["beige", "ivory", "taupe", "charcoal"]],
      ["Metallic colors", ["bronze", "copper", "silver", "brass"]],
      ["Pastel colors", ["peach", "lavender", "blush", "seafoam"]],
    ],
  },
  {
    name: "animal",
    groups: [
      ["Big cats", ["lion", "tiger", "leopard", "jaguar"]],
      ["Farm animals", ["cow", "pig", "sheep", "goat"]],
      ["Ocean mammals", ["whale", "dolphin", "seal", "otter"]],
      ["Birds of prey", ["eagle", "hawk", "owl", "falcon"]],
      ["Reptiles", ["snake", "lizard", "turtle", "crocodile"]],
      ["Insects", ["beetle", "moth", "ant", "bee"]],
      ["Pets", ["dog", "cat", "hamster", "rabbit"]],
      ["African animals", ["zebra", "giraffe", "hippo", "rhino"]],
    ],
  },
  {
    name: "food",
    groups: [
      ["Citrus fruits", ["orange", "lemon", "lime", "grapefruit"]],
      ["Breakfast foods", ["toast", "cereal", "pancake", "omelet"]],
      ["Italian dishes", ["pasta", "pizza", "risotto", "lasagna"]],
      ["Mexican dishes", ["taco", "burrito", "enchilada", "tamale"]],
      ["Sweet treats", ["cake", "cookie", "brownie", "donut"]],
      ["Vegetables", ["carrot", "broccoli", "spinach", "pepper"]],
      ["Cheeses", ["cheddar", "brie", "gouda", "parmesan"]],
      ["Street foods", ["hotdog", "pretzel", "nachos", "kebab"]],
    ],
  },
  {
    name: "instrument",
    groups: [
      ["String instruments", ["guitar", "violin", "cello", "banjo"]],
      ["Woodwinds", ["flute", "clarinet", "oboe", "bassoon"]],
      ["Brass instruments", ["trumpet", "trombone", "tuba", "horn"]],
      ["Percussion", ["drum", "cymbal", "tambourine", "xylophone"]],
      ["Keyboards", ["piano", "organ", "synth", "accordion"]],
      ["Folk instruments", ["mandolin", "ukulele", "harmonica", "bagpipes"]],
      ["Indian instruments", ["sitar", "tabla", "sarangi", "bansuri"]],
      ["Electronic instruments", ["synthesizer", "sampler", "theremin", "sequencer"]],
    ],
  },
  {
    name: "sport",
    groups: [
      ["Olympic sports", ["judo", "rowing", "fencing", "archery"]],
      ["Team sports", ["soccer", "basketball", "volleyball", "rugby"]],
      ["Winter sports", ["skiing", "snowboarding", "curling", "bobsled"]],
      ["Water sports", ["surfing", "swimming", "kayaking", "diving"]],
      ["Racket sports", ["tennis", "badminton", "squash", "pickleball"]],
      ["Track events", ["sprint", "hurdles", "marathon", "relay"]],
      ["Martial arts", ["karate", "taekwondo", "boxing", "aikido"]],
      ["Board games", ["chess", "checkers", "backgammon", "dominoes"]],
    ],
  },
];

function mulberry(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWith(value, random) {
  const result = [...value];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

const connections = [];
for (let index = 0; index < 100; index += 1) {
  const random = mulberry(9000 + index);
  const familyStart = index % connectionsFamilies.length;
  const families = [0, 1, 2, 3].map(
    (offset) => connectionsFamilies[(familyStart + offset + 1) % 5],
  );
  const groups = families.map((family, groupIndex) => {
    const [category, words] =
      family.groups[(index * 3 + groupIndex * 2) % family.groups.length];
    return { category, words: [...words], level: groupIndex + 1 };
  });
  const flat = groups.flatMap((group) => group.words.map((word) => word.toLowerCase()));
  if (new Set(flat).size !== flat.length) {
    throw new Error(`Connections puzzle ${index + 1} repeats a word`);
  }
  connections.push({
    id: `conn-${String(index + 1).padStart(3, "0")}`,
    groups: groups.map((group) => ({
      ...group,
      words: shuffleWith(group.words, random),
    })),
  });
}

const surveyQuestions = [
  ["Name something people do first thing in the morning", ["drink coffee", "take a shower", "check their phone", "hit snooze", "brush their teeth", "eat breakfast", "walk the dog", "stretch"]],
  ["Name something you might forget on a trip", ["passport", "phone charger", "toothbrush", "sunscreen", "keys", "wallet", "medication", "tickets"]],
  ["Name a food that is better cold", ["pizza", "watermelon", "ice cream", "cereal", "cheese", "pasta salad", "chocolate", "fried chicken"]],
  ["Name something people argue about in a car", ["directions", "music", "temperature", "parking", "who drives", "snacks", "arrival time", "the route"]],
  ["Name a place where people whisper", ["library", "cinema", "museum", "hospital", "funeral", "church", "golf course", "bedroom"]],
  ["Name something you keep in a kitchen drawer", ["scissors", "batteries", "takeout menus", "tape", "matches", "spoons", "towels", "junk"]],
  ["Name a reason people are late", ["traffic", "oversleeping", "getting dressed", "finding keys", "a phone call", "public transport", "a long queue", "forgetting something"]],
  ["Name something people do at a wedding", ["dance", "cry", "eat cake", "give a speech", "take photos", "throw confetti", "toast", "catch the bouquet"]],
  ["Name a thing that is always in a hotel room", ["towels", "a bed", "a television", "soap", "a kettle", "a wardrobe", "a lamp", "a phone"]],
  ["Name something that makes a loud noise", ["a siren", "a doorbell", "thunder", "a car alarm", "a blender", "a dog", "a baby", "a firework"]],
  ["Name a chore people avoid", ["washing dishes", "folding laundry", "cleaning the bathroom", "taking out trash", "ironing", "vacuuming", "dusting", "mowing the lawn"]],
  ["Name something you might find in a backpack", ["laptop", "water bottle", "snacks", "notebook", "keys", "headphones", "umbrella", "charger"]],
  ["Name a topping people put on pizza", ["cheese", "pepperoni", "mushrooms", "onions", "pineapple", "olives", "ham", "peppers"]],
  ["Name something people take a photo of on holiday", ["the beach", "food", "a landmark", "the hotel", "a sunset", "themselves", "a drink", "the view"]],
  ["Name a reason to call a friend", ["to catch up", "for advice", "to make plans", "for a favour", "to complain", "to share news", "to ask directions", "to say happy birthday"]],
  ["Name something that gets lost in a house", ["the remote", "keys", "socks", "scissors", "chargers", "glasses", "pens", "earrings"]],
  ["Name a thing people do while waiting", ["scroll their phone", "check the time", "pace", "read", "talk", "daydream", "drink coffee", "complain"]],
  ["Name something you might see at a farmers market", ["fresh fruit", "vegetables", "honey", "bread", "flowers", "cheese", "eggs", "jam"]],
  ["Name a thing that is hard to open", ["a jar", "a packet", "a parcel", "a champagne bottle", "a can", "a childproof lid", "a new box", "a stiff door"]],
  ["Name something people do at the beach", ["swim", "sunbathe", "build a sandcastle", "read", "play ball", "collect shells", "eat ice cream", "walk"]],
  ["Name a type of weather people complain about", ["rain", "heat", "cold", "wind", "humidity", "snow", "fog", "storms"]],
  ["Name something you might bring to a picnic", ["a blanket", "sandwiches", "drinks", "fruit", "a football", "sunscreen", "a cooler", "crisps"]],
  ["Name a place where you have to queue", ["supermarket", "airport", "bank", "theme park", "post office", "concert", "cafe", "doctor"]],
  ["Name something people do when they are nervous", ["bite their nails", "pace", "talk fast", "sweat", "fidget", "check their phone", "laugh", "drink water"]],
  ["Name a thing you might buy at a pharmacy", ["painkillers", "plasters", "shampoo", "vitamins", "cough syrup", "sunscreen", "toothpaste", "tissues"]],
  ["Name something that happens at a birthday party", ["cake", "presents", "singing", "games", "photos", "balloons", "speeches", "dancing"]],
  ["Name something you might do on a rainy day", ["watch a film", "read", "sleep", "bake", "clean", "play games", "listen to music", "stay in bed"]],
  ["Name a food people eat with their hands", ["pizza", "burger", "sandwich", "fries", "tacos", "chicken wings", "fruit", "crisps"]],
  ["Name something that is usually in a handbag", ["wallet", "phone", "keys", "tissues", "lipstick", "sunglasses", "snacks", "receipts"]],
  ["Name a thing people do at the gym", ["run", "lift weights", "stretch", "cycle", "swim", "row", "jump rope", "take a class"]],
];
const survey = [
  ...surveyQuestions,
  ...extraSurvey.map(([text, answers]) => [text, answers.split("|")]),
].map(([text, answers], index) => ({
  id: `survey-${String(index + 1).padStart(3, "0")}`,
  text,
  answers: answers.map((answer, rank) => ({
    text: answer,
    aliases: [answer.replace(/^a /, "")],
    points: [40, 30, 25, 20, 15, 10, 5, 5][rank],
  })),
}));

const scatterLists = [
  ["Things in a kitchen", "Things at a beach", "Animals with stripes", "Board games", "Things that are yellow", "Words ending in -ing", "Famous landmarks", "Things in a backpack"],
  ["Things at a birthday party", "Fruits", "Cartoon characters", "Things in a car", "Sports", "Things that are cold", "Places in a city", "Words with double letters"],
  ["Things in a bathroom", "Vegetables", "Things at school", "Musical instruments", "Things that fly", "Things in a hotel", "Jobs", "Things that are round"],
  ["Things in a supermarket", "Things at a campsite", "Birds", "Things in an office", "Things that are soft", "Holiday destinations", "Things in a garden", "Words starting with a vowel"],
  ["Things at a train station", "Things at a party", "Things in a bedroom", "Things that are loud", "Foods that are spicy", "Things in a wallet", "Things at the zoo", "Things that are sticky"],
  ["Things in a cinema", "Things that are green", "Animals in the sea", "Things in a library", "Things you can recycle", "Things at a wedding", "Things that are expensive", "Things that make you laugh"],
  ["Things in a hospital", "Things at the airport", "Things that are fragile", "Things in a toolbox", "Things in a fridge", "Things at a concert", "Things that are noisy", "Things in a park"],
  ["Things on a farm", "Things in space", "Things at the gym", "Things in a restaurant", "Things that are heavy", "Things at a museum", "Things in a pocket", "Things that are sweet"],
  ["Things in a classroom", "Things at a pool", "Things that are black and white", "Things at a wedding", "Things in a garage", "Things that are rare", "Things at a market", "Things with wheels"],
  ["Things at a beach", "Things in a forest", "Things at a train station", "Things in a bathroom", "Things that are blue", "Things at a football match", "Things in a handbag", "Things that are dangerous"],
  ["Things in a hotel", "Things at a cafe", "Things that are transparent", "Things with buttons", "Things in a suitcase", "Things at a festival", "Things that are quiet", "Things in a drawer"],
  ["Things at a zoo", "Things in a garden", "Things that are red", "Things in a nightclub", "Things at a library", "Things that are old", "Things at a sports shop", "Things in a wallet"],
  ["Things in a car", "Things at a farm", "Things that are square", "Things in a school bag", "Things at a concert", "Things that are expensive", "Things in a freezer", "Things that are funny"],
  ["Things in a kitchen", "Things at a party", "Things that are hot", "Things in a city", "Things at a supermarket", "Things that are cute", "Things in a hotel room", "Things that are loud"],
  ["Things at a station", "Things in a gym", "Things that are green", "Things at a hospital", "Things in a backpack", "Things that are round", "Things at a museum", "Things in a bathroom"],
  ["Things at a wedding", "Things in a fridge", "Things that are soft", "Things in a garden", "Things at an airport", "Things that are heavy", "Things in a classroom", "Things that are yellow"],
  ["Things at a beach", "Things in space", "Things that are cold", "Things in an office", "Things at a zoo", "Things that are sharp", "Things in a handbag", "Things that are sticky"],
  ["Things in a forest", "Things at a concert", "Things that are purple", "Things in a restaurant", "Things at a train station", "Things that are noisy", "Things in a toolbox", "Things that are sweet"],
  ["Things at a birthday party", "Things in a bathroom", "Things that fly", "Things in a supermarket", "Things at a wedding", "Things that are transparent", "Things in a car", "Things that are round"],
  ["Things at a campsite", "Things in a bedroom", "Things that are blue", "Things at a museum", "Things in a kitchen", "Things that are fragile", "Things at a party", "Things that are rare"],
];
const scatter = [...scatterLists, ...extraScatter].map((categories, index) => ({
  id: `scatter-${String(index + 1).padStart(3, "0")}`,
  categories,
}));

const starters = [
  "The elevator stopped between floors, and the lights went out.",
  "Nobody expected the vending machine to start talking.",
  "The wedding cake arrived with a small parachute attached.",
  "At 3 a.m., the hotel phone rang for the third time.",
  "The new neighbour's dog knew exactly where the treasure was buried.",
  "The office printer had finally developed a personality.",
  "The last train of the night was heading the wrong way.",
  "The museum guard noticed the painting had changed overnight.",
  "The camping trip took an unexpected turn when the map began to glow.",
  "The bakery's new pastry had a very suspicious name.",
  "The entire choir forgot the words at the same moment.",
  "The package had no address, only a drawing of a lighthouse.",
  "The weather forecast promised snow, but the sky was full of confetti.",
  "The old radio only played songs from the future.",
  "The restaurant had one table, one waiter, and no menu.",
  "The library book was returned with sand in every page.",
  "The football match was interrupted by a very determined goose.",
  "The new housemate arrived carrying a grandfather clock.",
  "The teacher's chair squeaked in complete sentences.",
  "The road trip playlist suddenly included a recording of the car.",
  "The plant on the windowsill had grown a tiny door.",
  "The office fridge contained a cake shaped like the boss.",
  "The ferry left the harbour with nobody at the wheel.",
  "The neighbours were having a very loud argument about soup.",
  "The theme park ride stopped at the highest point, facing the exit.",
  "The package arrived ten years after it was ordered.",
  "The cat brought home a receipt for something nobody bought.",
  "The last slice of pizza came with a handwritten warning.",
  "The art class was asked to paint the sound of a Monday.",
  "The supermarket announced a surprise guest over the intercom.",
];

const codenameCategories = {
  animals: ["otter", "badger", "falcon", "rabbit", "turtle", "panther", "dolphin", "penguin", "koala", "beaver", "heron", "gecko", "walrus", "donkey", "ferret", "parrot", "salmon", "weasel", "bison", "camel"],
  food: ["bread", "cheese", "apple", "pepper", "noodle", "butter", "melon", "carrot", "waffle", "yogurt", "pickle", "tomato", "mango", "cereal", "garlic", "biscuit", "coconut", "pumpkin", "mustard", "popcorn"],
  nature: ["river", "meadow", "volcano", "glacier", "forest", "desert", "island", "canyon", "harbour", "thunder", "fern", "pebble", "orchard", "moss", "summit", "valley", "reef", "prairie", "grove", "marsh"],
  household: ["kettle", "pillow", "ladder", "mirror", "carpet", "drawer", "hamper", "candle", "curtain", "teapot", "shelf", "bucket", "clock", "blanket", "toaster", "broom", "sponge", "vase", "stool", "hanger"],
  clothing: ["jacket", "sandal", "scarf", "mitten", "apron", "bonnet", "sweater", "boot", "glove", "cap", "belt", "sock", "robe", "badge", "pocket", "zipper", "button", "collar", "sleeve", "lace"],
  travel: ["passport", "suitcase", "ticket", "harbor", "station", "airport", "journey", "hotel", "map", "compass", "ferry", "taxi", "voyage", "border", "customs", "platform", "tour", "guide", "cabin", "lodge"],
  sports: ["racket", "stadium", "referee", "medal", "trophy", "helmet", "goal", "bicycle", "skate", "paddle", "wicket", "basket", "marathon", "sprint", "coach", "league", "final", "relay", "dive", "puck"],
  music: ["violin", "trumpet", "melody", "chorus", "guitar", "piano", "rhythm", "concert", "drum", "flute", "opera", "hymn", "tempo", "singer", "album", "stage", "encore", "harmony", "lyric", "fiddle"],
  jobs: ["doctor", "farmer", "pilot", "lawyer", "baker", "painter", "plumber", "teacher", "engineer", "nurse", "actor", "chef", "judge", "tailor", "dentist", "sailor", "writer", "guard", "clerk", "architect"],
  body: ["elbow", "shoulder", "finger", "ankle", "knee", "wrist", "thumb", "spine", "heart", "lung", "tooth", "tongue", "cheek", "eyebrow", "chin", "heel", "palm", "nerve", "rib", "joint"],
  school: ["pencil", "notebook", "eraser", "ruler", "chalk", "desk", "lesson", "library", "homework", "exam", "science", "history", "recital", "debate", "thesis", "diploma", "tutor", "campus", "lecture", "atlas"],
  tools: ["hammer", "wrench", "chisel", "drill", "saw", "screw", "pliers", "level", "clamp", "file", "tape", "wire", "nail", "bolt", "shovel", "hoe", "rake", "vice", "toolbox", "glue"],
  toys: ["kite", "puzzle", "marble", "doll", "robot", "yo-yo", "kaleidoscope", "balloon", "blocks", "train", "jacks", "crayon", "puppet", "whistle", "spinner", "teddy", "domino", "jigsaw", "slinky", "top"],
  weather: ["rain", "snow", "fog", "storm", "sunshine", "hail", "wind", "frost", "drizzle", "cloud", "heatwave", "monsoon", "lightning", "rainbow", "breeze", "sleet", "humid", "chill", "gale", "shower"],
  city: ["avenue", "bridge", "market", "tower", "plaza", "alley", "subway", "museum", "theatre", "square", "park", "fountain", "arcade", "bank", "cafe", "corner", "traffic", "sidewalk", "bench", "lamppost"],
  ocean: ["coral", "wave", "tide", "seagull", "shell", "kelp", "current", "wharf", "sail", "buoy", "shark", "jellyfish", "starfish", "lagoon", "foam", "deep", "salt", "surf", "coast", "dune"],
  space: ["planet", "comet", "orbit", "galaxy", "meteor", "rocket", "moon", "star", "nebula", "satellite", "telescope", "asteroid", "eclipse", "gravity", "cosmos", "shuttle", "alien", "crater", "solar", "lunar"],
  fantasy: ["dragon", "castle", "wizard", "sword", "spell", "goblin", "fairy", "troll", "quest", "crown", "kingdom", "potion", "knight", "giant", "enchanted", "prophecy", "dwarf", "elf", "myth", "legend"],
  verbs: ["run", "jump", "whisper", "build", "carry", "paint", "climb", "listen", "borrow", "shuffle", "invent", "rescue", "wander", "translate", "measure", "polish", "plant", "sketch", "launch", "gather"],
  adjectives: ["tiny", "bright", "quiet", "sturdy", "clever", "ancient", "spicy", "crooked", "velvet", "frozen", "sunny", "narrow", "brave", "rusty", "gentle", "wild", "sticky", "hollow", "brisk", "golden"],
};
const codenameWords = Object.values(codenameCategories).flat();
if (codenameWords.length < 400 || new Set(codenameWords).size !== codenameWords.length) {
  throw new Error("Codenames word list must contain 400 unique words");
}

const passwordWords = codenameWords.slice(0, 300).map((word, index) => ({
  id: `pw-${String(index + 1).padStart(3, "0")}`,
  text: word,
  difficulty: [1, 2, 3][index % 3],
}));

const sketchWords = codenameWords.slice(0, 300).map((word, index) => ({
  id: `sketch-${String(index + 1).padStart(3, "0")}`,
  text: word,
  difficulty: [1, 2, 3][index % 3],
}));

const triviaFacts = [
  ["Which planet is closest to the Sun?", "Mercury", ["mercury"], "Science"],
  ["What is the capital of France?", "Paris", ["paris"], "Geography"],
  ["What is the chemical symbol for gold?", "Au", ["au", "aurum"], "Science"],
  ["Who wrote Romeo and Juliet?", "William Shakespeare", ["shakespeare", "william shakespeare"], "Literature"],
  ["How many sides does a hexagon have?", "Six", ["6", "six"], "Maths"],
  ["Which ocean is the largest?", "Pacific", ["pacific", "pacific ocean"], "Geography"],
  ["What is the tallest mountain above sea level?", "Mount Everest", ["everest", "mount everest"], "Geography"],
  ["Which animal is the fastest land animal?", "Cheetah", ["cheetah"], "Nature"],
  ["How many continents are there?", "Seven", ["7", "seven"], "Geography"],
  ["What gas do plants absorb from the air?", "Carbon dioxide", ["carbon dioxide", "co2"], "Science"],
  ["Who painted the Mona Lisa?", "Leonardo da Vinci", ["leonardo da vinci", "da vinci"], "Art"],
  ["Which country is shaped like a boot?", "Italy", ["italy"], "Geography"],
  ["How many players are on a football team on the pitch?", "Eleven", ["11", "eleven"], "Sport"],
  ["What is the largest mammal?", "Blue whale", ["blue whale", "whale"], "Nature"],
  ["Which language has the most native speakers?", "Mandarin Chinese", ["mandarin", "chinese", "mandarin chinese"], "Language"],
  ["What is the freezing point of water in Celsius?", "Zero", ["0", "zero", "0 degrees"], "Science"],
  ["Who was the first person to walk on the Moon?", "Neil Armstrong", ["neil armstrong", "armstrong"], "History"],
  ["Which instrument has 88 keys?", "Piano", ["piano"], "Music"],
  ["What is the currency of Japan?", "Yen", ["yen"], "Geography"],
  ["How many strings does a standard violin have?", "Four", ["4", "four"], "Music"],
  ["Which vitamin is produced in skin from sunlight?", "Vitamin D", ["vitamin d", "d"], "Science"],
  ["What is the longest river in Africa?", "The Nile", ["nile", "the nile"], "Geography"],
  ["Which planet has the Great Red Spot?", "Jupiter", ["jupiter"], "Science"],
  ["Who wrote Pride and Prejudice?", "Jane Austen", ["jane austen", "austen"], "Literature"],
  ["What is the smallest prime number?", "Two", ["2", "two"], "Maths"],
  ["Which country invented paper?", "China", ["china"], "History"],
  ["What is the hardest natural substance?", "Diamond", ["diamond"], "Science"],
  ["How many colours are in a rainbow?", "Seven", ["7", "seven"], "Science"],
  ["Which sea creature has eight arms?", "Octopus", ["octopus"], "Nature"],
  ["What is the capital of Australia?", "Canberra", ["canberra"], "Geography"],
  ["Who composed the Fifth Symphony?", "Beethoven", ["beethoven", "ludwig van beethoven"], "Music"],
  ["Which sport uses a shuttlecock?", "Badminton", ["badminton"], "Sport"],
  ["How many degrees are in a right angle?", "Ninety", ["90", "ninety"], "Maths"],
  ["What is the main ingredient in guacamole?", "Avocado", ["avocado"], "Food"],
  ["Which country has the city of Marrakesh?", "Morocco", ["morocco"], "Geography"],
  ["What is the largest desert in the world?", "Antarctic Desert", ["antarctic", "antarctica", "antarctic desert"], "Geography"],
  ["Who developed the theory of relativity?", "Albert Einstein", ["einstein", "albert einstein"], "Science"],
  ["What is the capital of Canada?", "Ottawa", ["ottawa"], "Geography"],
  ["Which bird is known for mimicking human speech?", "Parrot", ["parrot"], "Nature"],
  ["How many minutes are in a full football match?", "Ninety", ["90", "ninety"], "Sport"],
  ["What is the largest organ in the human body?", "Skin", ["skin"], "Science"],
  ["Which artist cut off part of his ear?", "Vincent van Gogh", ["van gogh", "vincent van gogh"], "Art"],
  ["What is the chemical symbol for water?", "H2O", ["h2o", "water"], "Science"],
  ["Which country is home to the kangaroo?", "Australia", ["australia"], "Geography"],
  ["What is the first month of the year?", "January", ["january"], "General"],
  ["How many sides does a triangle have?", "Three", ["3", "three"], "Maths"],
  ["Which planet is known as the Red Planet?", "Mars", ["mars"], "Science"],
  ["What is the capital of Italy?", "Rome", ["rome"], "Geography"],
  ["Who wrote The Little Prince?", "Antoine de Saint-Exupéry", ["saint-exupery", "antoine de saint-exupery"], "Literature"],
  ["What is the fastest bird in a dive?", "Peregrine falcon", ["peregrine falcon", "peregrine"], "Nature"],
  ["Which country gifted the Statue of Liberty to the USA?", "France", ["france"], "History"],
  ["How many sides does a cube have?", "Six", ["6", "six"], "Maths"],
  ["What is the largest planet in the Solar System?", "Jupiter", ["jupiter"], "Science"],
  ["Which musical family includes the cello?", "Strings", ["string", "strings"], "Music"],
  ["What is the capital of Spain?", "Madrid", ["madrid"], "Geography"],
  ["Which animal is known as the ship of the desert?", "Camel", ["camel"], "Nature"],
  ["What is the study of stars called?", "Astronomy", ["astronomy"], "Science"],
  ["Who painted The Starry Night?", "Vincent van Gogh", ["van gogh", "vincent van gogh"], "Art"],
  ["Which sport is played at Wimbledon?", "Tennis", ["tennis"], "Sport"],
  ["What is the largest internal organ?", "Liver", ["liver"], "Science"],
  ["Which country has the Great Barrier Reef?", "Australia", ["australia"], "Geography"],
];

const trivia = [...triviaFacts, ...extraTrivia].map(([text, answer, aliases, category], index) => ({
  id: `buzz-${String(index + 1).padStart(3, "0")}`,
  text,
  answer,
  aliases,
  category,
  difficulty: (index % 3) + 1,
}));

const extraBoggleWords = [
  "cat", "dog", "bat", "rat", "hat", "mat", "sat", "tap", "nap", "map", "cap", "lap",
  "pen", "ten", "hen", "den", "men", "net", "wet", "pet", "set", "bet", "get", "let",
  "sun", "run", "fun", "bun", "gun", "nut", "cut", "but", "hut", "out", "our", "far",
  "car", "bar", "jar", "war", "was", "saw", "raw", "day", "say", "may", "pay", "way",
  "ice", "nice", "mice", "rice", "dice", "age", "cage", "page", "rage", "sage", "wage",
  "east", "west", "north", "south", "rain", "snow", "wind", "sand", "rock", "leaf",
  "tree", "bird", "fish", "frog", "bear", "wolf", "deer", "mole", "hare", "swan",
  "cake", "bake", "lake", "make", "take", "wake", "rake", "sake", "lane", "mane",
  "pane", "cane", "bone", "cone", "done", "gone", "lone", "tone", "zone", "stone",
  "star", "scar", "cart", "dart", "part", "tart", "mart", "ward", "card", "hard",
  "word", "work", "fork", "cork", "fort", "sort", "port", "sport", "short", "storm",
  "milk", "silk", "wilt", "tilt", "kilt", "hilt", "salt", "malt", "halt", "belt",
  "gold", "cold", "bold", "fold", "hold", "mold", "told", "sold", "old", "coal",
  "coin", "join", "loin", "soil", "boil", "foil", "oil", "nail", "rail", "mail",
  "sail", "tail", "fail", "hail", "pale", "sale", "tale", "male", "gale", "bale",
  "read", "head", "lead", "dead", "bread", "dream", "cream", "steam", "steel", "feel",
  "heel", "peel", "reel", "wheel", "seed", "weed", "feed", "need", "speed", "spoon",
  "moon", "noon", "soon", "boon", "room", "broom", "gloom", "bloom", "door", "floor",
  "wood", "good", "food", "mood", "hood", "book", "look", "cook", "hook", "nook",
  "took", "shook", "bank", "rank", "tank", "sank", "blank", "thank", "crane", "brain",
  "train", "chain", "plain", "plant", "plane", "plate", "slate", "skate", "state", "stage",
  "grape", "drape", "shape", "shade", "trade", "brave", "grave", "crave", "drive", "dive",
  "five", "hive", "live", "give", "river", "liver", "diver", "fever", "never", "ever",
];
const boggleWords = [...new Set([...codenameWords, ...extraBoggleWords])]
  .filter((word) => /^[a-z]{3,}$/.test(word))
  .sort();

await mkdir(prompts, { recursive: true });
await mkdir(path.join(out, "assets", "blur"), { recursive: true });

async function writeJson(relative, value) {
  const target = path.join(out, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

await writeJson("prompts/fillTheBlank.json", {
  prompts: ftbPrompts,
  answers: ftbAnswers,
});
await writeJson("prompts/connections.json", connections);
await writeJson("prompts/surveySays.json", survey);
await writeJson("prompts/scattergories.json", scatter);
await writeJson("prompts/storyChain.json", [...starters, ...extraStoryStarters].map((text, index) => ({
  id: `story-${String(index + 1).padStart(3, "0")}`,
  text,
})));
await writeJson("prompts/password.json", passwordWords);
await writeJson("prompts/codenames.json", codenameWords.map((text, index) => ({
  id: `cn-${String(index + 1).padStart(3, "0")}`,
  text,
})));
await writeJson("prompts/blindSketch.json", sketchWords);
await writeJson("prompts/buzzerTrivia.json", trivia);
await writeJson("boggleWords.json", boggleWords);

console.log(JSON.stringify({
  fillPrompts: ftbPrompts.length,
  fillAnswers: ftbAnswers.length,
  connections: connections.length,
  survey: survey.length,
  scatter: scatter.length,
  story: starters.length + extraStoryStarters.length,
  password: passwordWords.length,
  codenames: codenameWords.length,
  sketch: sketchWords.length,
  trivia: trivia.length,
  boggleWords: boggleWords.length,
}, null, 2));
