import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { pickRandom, shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/avoidTheAnswer.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Forty-five seconds to describe the secret word without its banned words",
    rounds: 4,
    playMs: 45_000,
    revealMs: 9_000,
  },
  blitz: {
    label: "Blitz",
    description: "A fast three-round version",
    rounds: 3,
    playMs: 25_000,
    revealMs: 6_000,
  },
};

function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function configFor(mode) {
  return MODES[mode] || MODES.classic;
}

function activePlayers(room) {
  return [...room.players.values()].filter((player) => player.connected);
}

function choosePrompt(state) {
  if (state.usedPromptIds.length >= PROMPTS.length) state.usedPromptIds = [];
  let index = Math.floor(Math.random() * PROMPTS.length);
  let guard = 0;
  while (state.usedPromptIds.includes(PROMPTS[index].id) && guard < 500) {
    index = Math.floor(Math.random() * PROMPTS.length);
    guard += 1;
  }
  state.usedPromptIds.push(PROMPTS[index].id);
  return PROMPTS[index];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function usesBannedWord(text, banned) {
  return banned.some((word) => {
    try {
      return new RegExp(`\\b${escapeRegExp(String(word))}\\b`, "i").test(text);
    } catch {
      return text.toLowerCase().includes(String(word).toLowerCase());
    }
  });
}

function beginRound(room, state) {
  const config = configFor(room.mode);
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  if (active.length < 2) {
    state.done = true;
    return;
  }

  state.round += 1;
  state.phase = "play";
  state.describerId = active[(state.round - 1) % active.length].id;
  state.prompt = choosePrompt(state);
  const distractors = pickRandom(
    PROMPTS.filter((prompt) => prompt.id !== state.prompt.id),
    3,
  ).map((prompt) => prompt.word);
  state.options = shuffle([state.prompt.word, ...distractors]);
  state.clues = [];
  state.guesses = [];
  state.winnerId = null;
  state.reveal = null;
  state.endsAt = Date.now() + config.playMs;
}

function resolveRound(room, state, reason) {
  state.reveal = {
    target: state.prompt.word,
    describerId: state.describerId,
    describerName: room.players.get(state.describerId)?.name || "Player",
    winnerId: state.winnerId,
    winnerName: state.winnerId
      ? room.players.get(state.winnerId)?.name || "Player"
      : null,
    clues: state.clues,
    guesses: state.guesses,
    reason,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(room.mode).revealMs;
}

const avoidTheAnswer = {
  id: "avoid-the-answer",
  name: "Avoid the Answer",
  description: "Describe the secret word without saying any of its banned words.",
  emoji: "🚫",
  accent: "pink",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "play",
      round: 0,
      rounds: configFor(room.mode).rounds,
      describerId: null,
      prompt: null,
      options: [],
      clues: [],
      guesses: [],
      winnerId: null,
      reveal: null,
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginRound(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "play") return;

    if (event.type === "clue") {
      if (playerId !== state.describerId) {
        throw failure("not_describer", "Only the describer can send clues");
      }
      const clue = String(event.value ?? "").trim().slice(0, 140);
      if (!clue) throw failure("clue_required", "Type a clue first");
      if (usesBannedWord(clue, [state.prompt.word, ...state.prompt.banned])) {
        throw failure("banned_word", "That clue uses a banned word");
      }
      if (state.clues.length >= 20) {
        throw failure("too_many_clues", "That is enough clues for this round");
      }
      state.clues.push({
        id: randomUUID(),
        playerId,
        name: room.players.get(playerId)?.name || "Describer",
        text: clue,
      });
      return;
    }

    if (event.type === "guess") {
      if (playerId === state.describerId) {
        throw failure("describer_cannot_guess", "You are describing, not guessing");
      }
      if (state.winnerId) return;
      const value = String(event.value || "");
      if (!state.options.includes(value)) {
        throw failure("invalid_guess", "Pick one of the available words");
      }
      const correct = value === state.prompt.word;
      state.guesses.push({
        playerId,
        name: room.players.get(playerId)?.name || "Player",
        value,
        correct,
      });
      if (!correct) return;

      state.winnerId = playerId;
      room.scores[playerId] = Number(room.scores[playerId] || 0) + 2;
      if (room.players.has(state.describerId)) {
        room.scores[state.describerId] =
          Number(room.scores[state.describerId] || 0) + 1;
      }
      resolveRound(room, state, "guessed");
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "play") {
      resolveRound(room, state, "timeout");
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      beginRound(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    if (playerId === state.describerId || activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isDescriber = viewerId === state.describerId;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      mode: room.mode,
      isDescriber,
      describerName: room.players.get(state.describerId)?.name || "Player",
      options: state.options,
      clues: state.clues,
      playMs: configFor(room.mode).playMs,
    };

    if (state.phase === "play") {
      return {
        ...base,
        target: isDescriber ? state.prompt.word : null,
        banned: isDescriber ? state.prompt.banned : [],
        guesses: state.guesses,
      };
    }

    return {
      ...base,
      target: state.reveal?.target || null,
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      describerName: room.players.get(state.describerId)?.name || "Player",
      options: state.options,
      clues: state.clues,
    };
    if (state.phase === "play") {
      return { ...base, guesses: state.guesses };
    }
    return { ...base, reveal: state.reveal };
  },
};

export default avoidTheAnswer;
