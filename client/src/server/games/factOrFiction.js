import { createRequire } from "node:module";
import {
  activePlayers,
  addPoints,
  choosePrompt,
  commitPoints,
  configFor,
  failure,
  pointsList,
} from "./shared.js";

const require = createRequire(import.meta.url);
const STATEMENTS = require("../data/prompts/factOrFiction.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Ten statements, ten seconds each, speed and streaks score",
    questionMs: 10_000,
    revealMs: 6_000,
    rounds: 10,
  },
  "sudden-death": {
    label: "Sudden Death",
    description: "One wrong answer eliminates you; last player standing wins",
    questionMs: 10_000,
    revealMs: 6_000,
    rounds: 30,
  },
};

function streakMultiplier(streak) {
  if (streak >= 6) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

function nextQuestion(room, state) {
  if (state.questionCount >= state.config.rounds) {
    state.done = true;
    return "results";
  }
  state.questionCount += 1;
  state.phase = "question";
  state.current = choosePrompt(STATEMENTS, state);
  state.answers = {};
  state.reveal = null;
  state.questionStartedAt = Date.now();
  state.endsAt = state.questionStartedAt + state.config.questionMs;
}

function resolveQuestion(room, state) {
  const question = state.current;
  if (!question) return;

  const points = new Map();
  const results = [];
  const eliminated = [];
  const now = Date.now();

  for (const player of activePlayers(room)) {
    if (room.mode === "sudden-death" && !state.alive.includes(player.id)) continue;
    const answer = state.answers[player.id];
    const correct = Boolean(answer && answer.value === question.isTrue);
    let streak = state.streaks[player.id] || 0;
    let gained = 0;

    if (correct) {
      streak += 1;
      const speed =
        answer && state.config.questionMs > 0
          ? Math.round(
              50 *
                Math.max(
                  0,
                  1 - (answer.at - state.questionStartedAt) / state.config.questionMs,
                ),
            )
          : 0;
      gained = Math.round(100 * streakMultiplier(streak)) + speed;
      addPoints(room, points, player.id, gained);
    } else {
      streak = 0;
      if (room.mode === "sudden-death") {
        state.alive = state.alive.filter((id) => id !== player.id);
        eliminated.push({ playerId: player.id, name: player.name });
      }
    }
    state.streaks[player.id] = streak;
    results.push({
      playerId: player.id,
      name: player.name,
      answer: answer ? (answer.value ? "true" : "false") : "no answer",
      correct,
      points: gained,
      streak,
    });
  }

  commitPoints(room, points);
  state.reveal = {
    statement: question.text,
    isTrue: question.isTrue,
    explanation: question.explanation,
    results,
    eliminated,
    roundPoints: pointsList(room, points),
    alive:
      room.mode === "sudden-death"
        ? state.alive
            .map((id) => room.players.get(id)?.name || "Player")
            .filter(Boolean)
        : null,
  };
  state.phase = "reveal";
  state.endsAt = now + state.config.revealMs;
}

const factOrFiction = {
  id: "fact-or-fiction",
  name: "Fact or Fiction",
  description: "True or false? Answer fast, build a streak, and survive sudden death.",
  emoji: "✅",
  accent: "teal",
  tag: "Trivia",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const players = activePlayers(room);
    const state = {
      phase: "question",
      questionCount: 0,
      config: configFor(MODES, room.mode),
      current: null,
      answers: {},
      streaks: Object.fromEntries(players.map((player) => [player.id, 0])),
      alive: players.map((player) => player.id),
      reveal: null,
      usedPromptIds: [],
      done: false,
      questionStartedAt: 0,
      endsAt: null,
    };
    room.state = state;
    nextQuestion(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "question" || event.type !== "answer") return;

    if (state.answers[playerId] !== undefined) {
      throw failure("already_answered", "You already answered");
    }
    if (room.mode === "sudden-death" && !state.alive.includes(playerId)) {
      throw failure("eliminated", "You are out of this round");
    }
    const value = event.value;
    if (value !== true && value !== false) {
      throw failure("invalid_answer", "Choose true or false");
    }
    state.answers[playerId] = { value, at: Date.now() };
    const players = activePlayers(room).filter(
      (player) => room.mode !== "sudden-death" || state.alive.includes(player.id),
    );
    if (players.every((player) => state.answers[player.id] !== undefined)) {
      resolveQuestion(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "question") {
      resolveQuestion(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (room.mode === "sudden-death" && state.alive.length <= 1) {
        state.done = true;
        return "results";
      }
      return nextQuestion(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.answers[playerId];
    delete state.streaks[playerId];
    state.alive = state.alive.filter((id) => id !== playerId);

    if (
      activePlayers(room).length < 3 ||
      (room.mode === "sudden-death" && state.alive.length <= 1)
    ) {
      state.done = true;
      return "results";
    }
    if (state.phase === "question") {
      const players = activePlayers(room).filter(
        (player) => room.mode !== "sudden-death" || state.alive.includes(player.id),
      );
      if (players.every((player) => state.answers[player.id] !== undefined)) {
        resolveQuestion(room, state);
      }
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    if (state.phase === "question") {
      return {
        phase: "question",
        round: state.questionCount,
        rounds: state.config.rounds,
        statement: state.current?.text || "",
        submitted: Object.keys(state.answers).length,
        total: activePlayers(room).filter(
          (player) => room.mode !== "sudden-death" || state.alive.includes(player.id),
        ).length,
        myAnswer:
          state.answers[viewerId] === undefined
            ? null
            : state.answers[viewerId].value,
        myStreak: state.streaks[viewerId] || 0,
        alive: room.mode === "sudden-death" ? state.alive.length : null,
        questionMs: state.config.questionMs,
      };
    }
    return {
      phase: "reveal",
      round: state.questionCount,
      rounds: state.config.rounds,
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    if (state.phase === "question") {
      return {
        phase: "question",
        round: state.questionCount,
        rounds: state.config.rounds,
        statement: state.current?.text || "",
        submitted: Object.keys(state.answers).length,
        total: activePlayers(room).filter(
          (player) => room.mode !== "sudden-death" || state.alive.includes(player.id),
        ).length,
        alive: room.mode === "sudden-death" ? state.alive.length : null,
      };
    }
    return {
      phase: "reveal",
      round: state.questionCount,
      rounds: state.config.rounds,
      reveal: state.reveal,
    };
  },
};

export default factOrFiction;
