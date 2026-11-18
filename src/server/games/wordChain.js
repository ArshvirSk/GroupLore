import { activePlayers, configFor, failure } from "./shared.js";
import { isWord, WORD_LIST } from "../engine/primitives/dictionary.js";
import { normalizeWord } from "../engine/primitives/normalize.js";

const MODES = {
  classic: { label: "Classic", description: "Three trips around the table, twenty seconds each", turnsPerPlayer: 3, turnMs: 20_000 },
  sprint: { label: "Sprint", description: "Two fast trips with ten-second turns", turnsPerPlayer: 2, turnMs: 10_000 },
};

const STARTERS = WORD_LIST.filter((word) => /[aeioustnrl]$/.test(word) && word.length >= 4);

function currentId(state) {
  return state.order[state.turnIndex % state.order.length] || null;
}

function advance(room, state) {
  state.turnIndex += 1;
  state.turnsTaken += 1;
  if (state.turnsTaken >= state.turnsTotal) {
    state.done = true;
    state.phase = "results";
    state.endsAt = null;
    return "results";
  }
  state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
  return undefined;
}

const wordChain = {
  id: "word-chain",
  name: "Word Chain", description: "Each word starts with the last letter of the word before it.",
  emoji: "🔗", accent: "teal", tag: "Real-time",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
    const starter = STARTERS[Math.floor(Math.random() * STARTERS.length)];
    room.state = {
      phase: "play", turnIndex: 0, turnsTaken: 0, turnsTotal: active.length * config.turnsPerPlayer,
      order: active.map((player) => player.id), chain: [starter], usedWords: [starter],
      lastWord: starter, done: false, endsAt: Date.now() + config.turnMs,
    };
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "play" || event.type !== "word") return;
    if (playerId !== currentId(state)) throw failure("not_your_turn", "It is not your turn");
    const word = normalizeWord(event.word);
    if (word.length < 2) throw failure("word_too_short", "Use at least two letters");
    const required = state.lastWord.slice(-1);
    if (!word.startsWith(required)) throw failure("wrong_letter", `Your word must start with "${required}"`);
    if (!isWord(word)) throw failure("not_a_word", "That word is not in the dictionary");
    if (state.usedWords.includes(word)) throw failure("word_used", "That word was already played");
    state.chain.push(word);
    state.usedWords.push(word);
    state.lastWord = word;
    room.scores[playerId] = Number(room.scores[playerId] || 0) + 100 + word.length * 10;
    return advance(room, state);
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "play") return advance(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    state.order = state.order.filter((id) => id !== playerId);
    if (state.order.length < 2) {
      state.done = true;
      state.phase = "results";
      return "results";
    }
    state.turnIndex %= state.order.length;
    state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const current = currentId(state);
    return {
      phase: state.phase, mode: room.mode,
      chain: state.chain.slice(-14), lastWord: state.lastWord,
      requiredLetter: state.lastWord.slice(-1),
      currentId: current, currentName: room.players.get(current)?.name || "Player",
      isMyTurn: current === viewerId, turnMs: configFor(MODES, room.mode).turnMs,
      turnsTaken: state.turnsTaken, turnsTotal: state.turnsTotal,
    };
  },

  publicFor(room) {
    const state = room.state;
    const current = currentId(state);
    return {
      phase: state.phase, chain: state.chain.slice(-14), lastWord: state.lastWord,
      requiredLetter: state.lastWord.slice(-1),
      currentName: room.players.get(current)?.name || "Player",
      turnsTaken: state.turnsTaken, turnsTotal: state.turnsTotal,
    };
  },
};

export default wordChain;
