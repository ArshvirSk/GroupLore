type Nudge = {
  message: string;
  from: string;
  timestamp: number;
};

const NUDGE_MESSAGES = [
  "START THE GAME ALREADY",
  "We're literally dying of boredom here",
  "The vibes are dying. START IT.",
  "Hello?? Is this thing on?? 🎤",
  "If you don't start in 10 seconds I'm leaving",
  "My grandma loads faster than you",
  "The suspense is killing us... START IT",
  "We didn't come here to stare at a screen",
  "Bro thinks we have all day 💀",
  "I've aged 3 years waiting for you",
  "The game isn't gonna start itself bestie",
  "WAKE UP. START. THE. GAME.",
];

const globalStore = globalThis as typeof globalThis & {
  __grouploreNudges?: Map<string, Nudge[]>;
};

const nudges =
  globalStore.__grouploreNudges ??
  (globalStore.__grouploreNudges = new Map<string, Nudge[]>());

export function addNudge(groupId: string, from: string) {
  const message =
    NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
  const queue = nudges.get(groupId) || [];
  queue.push({ message, from, timestamp: Date.now() });
  nudges.set(groupId, queue.slice(-10));
  return { sent: true, message };
}

export function drainNudges(groupId: string) {
  const pending = nudges.get(groupId) || [];
  nudges.set(groupId, []);
  return pending;
}
