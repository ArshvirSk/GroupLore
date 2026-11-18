import { activePlayers, configFor, failure } from "./shared.js";
import { isWord, WORD_LIST } from "../engine/primitives/dictionary.js";
import { normalizeWord } from "../engine/primitives/normalize.js";

const MODES = {
  classic: { label: "Classic", description: "Three lives, fifteen seconds a turn", turnMs: 15_000, lives: 3, revealMs: 8_000 },
  quick: { label: "Quick", description: "Two lives and eight seconds", turnMs: 8_000, lives: 2, revealMs: 6_000 },
};

const PROMPTS = (() => {
  const counts = new Map();
  for (const word of WORD_LIST) {
    if (word.length < 4) continue;
    for (let index = 0; index < word.length - 1; index += 1) {
      const pair = word.slice(index, index + 2);
      if (!/^[a-z]{2}$/.test(pair)) continue;
      counts.set(pair, (counts.get(pair) || 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 12).map(([pair]) => pair);
})();

function pickPrompt(state) {
  let prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  let guard = 0;
  while (prompt === state.prompt && guard < 30) {
    prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    guard += 1;
  }
  return prompt;
}

function beginRound(room, state) {
  state.round += 1;
  state.phase = "play";
  state.prompt = pickPrompt(state);
  state.usedWords = [];
  state.turnIndex = state.turnIndex % Math.max(1, state.aliveIds.length);
  state.endedBy = null;
  state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
}

function currentId(state) {
  return state.aliveIds[state.turnIndex % state.aliveIds.length] || null;
}

function eliminateCurrent(room, state) {
  const playerId = currentId(state);
  if (!playerId) return;
  state.lives[playerId] = Math.max(0, (state.lives[playerId] || 0) - 1);
  state.exploded = {
    playerId, name: room.players.get(playerId)?.name || "Player",
    livesLeft: state.lives[playerId],
  };
  if (state.lives[playerId] <= 0) {
    state.aliveIds = state.aliveIds.filter((id) => id !== playerId);
    state.turnIndex = state.turnIndex % Math.max(1, state.aliveIds.length);
  }
  if (state.aliveIds.length <= 1) {
    const winnerId = state.aliveIds[0] || null;
    if (winnerId) room.scores[winnerId] = Number(room.scores[winnerId] || 0) + 500;
    state.winnerId = winnerId;
    state.phase = "reveal";
    state.done = true;
    state.endsAt = null;
    return;
  }
  beginRound(room, state);
}

const bombParty = {
  id: "bomb-party",
  name: "Bomb Party", description: "Say a word containing the letters before the bomb goes off.",
  emoji: "💣", accent: "coral", tag: "Real-time",
  minPlayers: 3, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
    room.state = {
      phase: "play", round: 0, turnIndex: 0, prompt: null, usedWords: [],
      lives: Object.fromEntries(active.map((player) => [player.id, config.lives])),
      aliveIds: active.map((player) => player.id), exploded: null, winnerId: null,
      done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "play" || event.type !== "word") return;
    if (playerId !== currentId(state)) throw failure("not_your_turn", "It is not your turn");
    const word = normalizeWord(event.word);
    if (word.length < 3) throw failure("word_too_short", "Use at least three letters");
    if (!word.includes(state.prompt)) throw failure("missing_prompt", `Your word must contain "${state.prompt}"`);
    if (!isWord(word)) throw failure("not_a_word", "That word is not in the dictionary");
    if (state.usedWords.includes(word)) throw failure("word_used", "That word was already played");
    state.usedWords.push(word);
    room.scores[playerId] = Number(room.scores[playerId] || 0) + 50 + word.length * 10;
    state.exploded = { playerId: null, name: null, livesLeft: null };
    state.turnIndex = (state.turnIndex + 1) % state.aliveIds.length;
    state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "play") {
      eliminateCurrent(room, state);
      return state.done ? "results" : undefined;
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    state.aliveIds = state.aliveIds.filter((id) => id !== playerId);
    delete state.lives[playerId];
    if (state.aliveIds.length < 2) {
      const winnerId = state.aliveIds[0] || null;
      if (winnerId) room.scores[winnerId] = Number(room.scores[winnerId] || 0) + 500;
      state.winnerId = winnerId;
      state.done = true;
      state.phase = "reveal";
      return "results";
    }
    state.turnIndex %= state.aliveIds.length;
    state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const current = currentId(state);
    return {
      phase: state.phase, round: state.round, mode: room.mode,
      prompt: state.prompt, usedWords: state.usedWords.slice(-12),
      currentId: current, currentName: room.players.get(current)?.name || "Player",
      isMyTurn: current === viewerId, lives: state.lives[viewerId] ?? 0,
      standings: state.aliveIds.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player", lives: state.lives[id] })),
      exploded: state.exploded, winnerId: state.winnerId, turnMs: configFor(MODES, room.mode).turnMs,
    };
  },

  publicFor(room) {
    const state = room.state;
    const current = currentId(state);
    return {
      phase: state.phase, round: state.round, prompt: state.prompt,
      currentName: room.players.get(current)?.name || "Player",
      usedWords: state.usedWords.slice(-12),
      standings: state.aliveIds.map((id) => ({ playerId: id, name: room.players.get(id)?.name || "Player", lives: state.lives[id] })),
      exploded: state.exploded, winnerId: state.winnerId,
    };
  },
};

export default bombParty;
