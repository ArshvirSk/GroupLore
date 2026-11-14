import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { answersMatch } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const IMAGES = require("../data/assets/blur/manifest.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Eight images, six blur stages, twenty seconds each",
    rounds: 8,
    stageMs: 3_300,
    resultMs: 6_000,
  },
  hard: {
    label: "Hard",
    description: "Six images with less time at every stage",
    rounds: 6,
    stageMs: 2_600,
    resultMs: 5_000,
  },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  state.image = state.images[state.round - 1];
  state.stage = 1;
  state.wrong = {};
  state.reveal = null;
  state.phase = "stage";
  state.endsAt = Date.now() + config.stageMs;
  return undefined;
}

function finishRound(room, state, winnerId = null) {
  const config = configFor(MODES, room.mode);
  state.reveal = {
    answer: state.image.answer,
    category: state.image.category,
    sharp: state.image.sharp,
    winnerId,
    winnerName: winnerId ? room.players.get(winnerId)?.name || "Player" : null,
  };
  state.phase = "result";
  state.endsAt = Date.now() + config.resultMs;
}

const blurGuess = {
  id: "blur-guess",
  name: "Blur Guess",
  description: "Name the picture as the blur lifts, stage by stage.",
  emoji: "🖼️",
  accent: "lavender",
  tag: "Trivia",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const shuffledImages = [...IMAGES].sort(() => Math.random() - 0.5);
    const state = {
      phase: "stage",
      round: 0,
      rounds: configFor(MODES, room.mode).rounds,
      stage: 1,
      images: shuffledImages,
      image: null,
      wrong: {},
      reveal: null,
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
    if (state.phase !== "stage" || event.type !== "guess") return;
    if (state.wrong[playerId]) {
      throw failure("already_guessed", "You already guessed this image");
    }
    const guess = String(event.value ?? "").trim().slice(0, 80);
    if (!guess) throw failure("guess_required", "Type a guess");
    const correct =
      answersMatch(guess, state.image.answer) ||
      (state.image.aliases || []).some((alias) => answersMatch(guess, alias));
    if (!correct) {
      state.wrong[playerId] = guess;
      room.scores[playerId] = Number(room.scores[playerId] || 0) - 25;
      return;
    }
    const points = 100 * (7 - state.stage);
    room.scores[playerId] = Number(room.scores[playerId] || 0) + points;
    finishRound(room, state, playerId);
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "stage") {
      if (state.stage >= 6) {
        finishRound(room, state, null);
        return;
      }
      state.stage += 1;
      state.endsAt = Date.now() + configFor(MODES, room.mode).stageMs;
      return;
    }
    if (state.phase === "result") {
      return beginRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.wrong[playerId];
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      stage: state.stage,
      stageImage: state.image?.stages?.[state.stage - 1] || null,
      stageTotal: 6,
      guessed: Boolean(state.wrong[viewerId]),
      wrong: state.wrong[viewerId] || null,
      result: null,
    };
    if (state.phase === "result") {
      return { ...base, result: state.reveal };
    }
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      stage: state.stage,
      stageImage: state.image?.stages?.[state.stage - 1] || null,
    };
    return state.phase === "result" ? { ...base, result: state.reveal } : base;
  },
};

export default blurGuess;
