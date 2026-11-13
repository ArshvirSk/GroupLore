export type GameCategory =
  | "Write"
  | "Draw"
  | "Trivia"
  | "Social"
  | "Real-time"
  | "Strategy";

import type { IconName } from "@/components/ui/Icon";

export type GameMeta = {
  id: string;
  name: string;
  icon: IconName;
  category: GameCategory;
  description: string;
  color: string;
};

const COLORS = [
  "#FF5C8A",
  "#3D5AFE",
  "#FFD400",
  "#00C853",
  "#00B8D9",
  "#FF8A00",
  "#9B5DE5",
  "#00A896",
] as const;

const DATA: Record<
  string,
  { name: string; icon: IconName; category: GameCategory; description: string }
> = {
  "most-likely-to": { name: "Most Likely To", icon: "eye", category: "Social", description: "Vote for the friend most likely to cause the chaos." },
  "guess-impostor": { name: "Guess the Impostor", icon: "search", category: "Social", description: "Find the player who never got the secret prompt." },
  "five-second": { name: "Five Second Frenzy", icon: "zap", category: "Real-time", description: "Name three things before the clock runs out." },
  "overrated-underrated": { name: "Overrated / Underrated", icon: "scale", category: "Trivia", description: "Defend the hottest takes on everyday things." },
  "hive-mind": { name: "Hive Mind", icon: "brain", category: "Write", description: "Match answers with the group without coordinating." },
  "odd-one-out": { name: "Odd One Out", icon: "search", category: "Strategy", description: "Spot the answer that does not belong." },
  bluff: { name: "Bluff", icon: "mask", category: "Write", description: "Invent a convincing lie and fool the table." },
  "hot-takes": { name: "Hot Takes", icon: "flame", category: "Social", description: "Agree, disagree, and defend your wildest opinions." },
  "liars-bar": { name: "Liar's Bar", icon: "glass", category: "Strategy", description: "Read the room and catch a lie in progress." },
  "higher-or-lower": { name: "Higher or Lower", icon: "trending", category: "Trivia", description: "Guess whether the number goes up or down." },
  "avoid-the-answer": { name: "Avoid the Answer", icon: "ban", category: "Strategy", description: "Answer without saying the obvious thing." },
  "would-you-rather": { name: "Would You Rather", icon: "shuffle", category: "Social", description: "Pick a side and see who joins you." },
  "caption-this": { name: "Caption This", icon: "image", category: "Write", description: "Write the caption that makes the room lose it." },
  wavelength: { name: "Wavelength", icon: "signal", category: "Strategy", description: "Find the secret point between two extremes." },
  "category-rush": { name: "Category Rush", icon: "folder", category: "Real-time", description: "Race to name something that fits the category." },
  "roast-battle": { name: "Roast Battle", icon: "flame", category: "Write", description: "Trade playful roasts and vote for the best hit." },
  "acronym-wars": { name: "Acronym Wars", icon: "type", category: "Write", description: "Turn nonsense letters into a believable phrase." },
  "pitch-perfect": { name: "Pitch Perfect", icon: "mic", category: "Write", description: "Pitch a ridiculous idea like it is a real business." },
  "mad-libs": { name: "Mad Libs", icon: "puzzle", category: "Write", description: "Fill the blanks and unleash a cursed story." },
  "two-truths": { name: "Two Truths", icon: "mask", category: "Social", description: "Separate the truth from two impressive lies." },
  "fact-or-fiction": { name: "Fact or Fiction", icon: "book", category: "Trivia", description: "Decide whether the strange fact is real." },
};

function hash(id: string) {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) {
    value = (value * 31 + id.charCodeAt(index)) >>> 0;
  }
  return value;
}

export function gameMeta(id: string): GameMeta {
  const item = DATA[id];
  const fallbackName = id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    id,
    name: item?.name || fallbackName || "Mystery game",
    icon: item?.icon || "dice",
    category: item?.category || "Social",
    description: item?.description || "A new GroupLore game is waiting to be played.",
    color: COLORS[hash(id) % COLORS.length],
  };
}

export const GAME_CATEGORIES: GameCategory[] = [
  "Write",
  "Draw",
  "Trivia",
  "Social",
  "Real-time",
  "Strategy",
];

export { COLORS as GAME_ACCENTS };
