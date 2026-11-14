import { createRequire } from "node:module";
import {
  activePlayers,
  addPoints,
  choosePrompt,
  configFor,
  failure,
  pointsList,
} from "./shared.js";
import { normalizeText } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const LISTS = require("../data/prompts/scattergories.json");
const LETTERS = "ABCDEFGHIJKLMNOPRSTWY".split("");
const EXCLUDED = new Set(["Q", "U", "X", "Z", "V"]);

const MODES = {
  classic: {
    label: "Classic",
    description: "Five rounds, eight categories, ninety seconds",
    rounds: 5,
    categories: 8,
    answerMs: 90_000,
    challengeMs: 10_000,
    compareMs: 12_000,
  },
  blitz: {
    label: "Blitz",
    description: "Six categories and forty-five seconds",
    rounds: 5,
    categories: 6,
    answerMs: 45_000,
    challengeMs: 10_000,
    compareMs: 9_000,
  },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  const list = choosePrompt(LISTS, state);
  state.categories = list.categories.slice(0, config.categories);
  state.letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  while (EXCLUDED.has(state.letter)) {
    state.letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  state.answers = {};
  state.reveal = null;
  state.candidates = [];
  state.challenges = {};
  state.points = new Map();
  state.phase = "answer";
  state.endsAt = Date.now() + config.answerMs;
  return undefined;
}

function firstLetter(value) {
  return normalizeText(value).charAt(0).toUpperCase();
}

function buildCandidates(room, state) {
  return state.categories.map((category, index) => ({
    category,
    answers: activePlayers(room).map((player) => {
      const text = String(state.answers[player.id]?.[index] || "").trim();
      return {
        playerId: player.id,
        name: player.name,
        text,
        valid: Boolean(text) && firstLetter(text) === state.letter,
        key: normalizeText(text),
        challenged: false,
        challengeAccepted: false,
        shared: false,
        points: 0,
      };
    }),
  }));
}

function eligibleVoters(room, targetId) {
  return activePlayers(room).filter((player) => player.id !== targetId);
}

function allChallengesVoted(room, state) {
  const open = Object.values(state.challenges);
  if (!open.length) return false;
  return open.every((challenge) =>
    eligibleVoters(room, challenge.targetId).every(
      (player) => challenge.votes[player.id] !== undefined,
    ),
  );
}

function beginChallenge(room, state) {
  const config = configFor(MODES, room.mode);
  state.candidates = buildCandidates(room, state);
  state.challenges = {};
  state.reveal = null;
  state.phase = "challenge";
  state.endsAt = Date.now() + config.challengeMs;
}

function finalizeRound(room, state) {
  const config = configFor(MODES, room.mode);
  const challenged = new Map();
  const challengeRows = [];
  for (const challenge of Object.values(state.challenges)) {
    const votes = Object.values(challenge.votes);
    const accept = votes.filter(Boolean).length;
    const reject = votes.length - accept;
    const accepted = accept > reject;
    challenged.set(challenge.key, accepted);
    challengeRows.push({
      ...challenge,
      accept,
      reject,
      accepted,
    });
  }

  const normalized = state.candidates.map((row) =>
    row.answers.map((answer) => {
      const key = `${row.category}:${answer.playerId}`;
      const invalidated = challenged.get(key) === true;
      return {
        ...answer,
        challenged: state.challenges[key] ? true : false,
        challengeAccepted: invalidated,
        valid: answer.valid && !invalidated,
      };
    }),
  );

  const points = new Map();
  const rows = state.categories.map((category, index) => {
    const entries = normalized[index];
    const counts = new Map();
    for (const entry of entries) {
      if (entry.valid && entry.key) {
        counts.set(entry.key, (counts.get(entry.key) || 0) + 1);
      }
    }
    return {
      category,
      answers: entries.map((entry) => {
        const shared = entry.valid && (counts.get(entry.key) || 0) > 1;
        const pointsEarned = entry.valid && !shared ? 100 : 0;
        if (pointsEarned) addPoints(room, points, entry.playerId, pointsEarned);
        return { ...entry, shared, points: pointsEarned };
      }),
    };
  });

  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }
  state.reveal = {
    letter: state.letter,
    rows,
    challenges: challengeRows,
    roundPoints: pointsList(room, points),
  };
  state.phase = "compare";
  state.endsAt = Date.now() + config.compareMs;
}

const scattergories = {
  id: "scattergories",
  name: "Scattergories",
  description: "Race the letter and avoid answers that match the room.",
  emoji: "🗂️",
  accent: "coral",
  tag: "Write",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const state = {
      phase: "answer",
      round: 0,
      rounds: config.rounds,
      letter: "A",
      categories: [],
      answers: {},
      candidates: [],
      challenges: {},
      reveal: null,
      points: new Map(),
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
    if (state.phase === "answer" && event.type === "answer") {
      if (state.answers[playerId]) {
        throw failure("already_answered", "You already submitted answers");
      }
      const values = event.values && typeof event.values === "object" ? event.values : {};
      const answers = {};
      for (let index = 0; index < state.categories.length; index += 1) {
        const text = String(values[index] || values[state.categories[index]] || "").trim().slice(0, 60);
        if (text && firstLetter(text) !== state.letter) {
          throw failure(
            "wrong_letter",
            `“${text}” does not start with ${state.letter}`,
          );
        }
        answers[index] = text;
      }
      state.answers[playerId] = answers;
      if (activePlayers(room).every((player) => state.answers[player.id])) {
        beginChallenge(room, state);
      }
      return undefined;
    }

    if (state.phase === "challenge" && event.type === "challenge") {
      const categoryIndex = Number(event.categoryIndex);
      const targetId = String(event.targetId || "");
      const target = state.candidates[categoryIndex]?.answers.find(
        (answer) => answer.playerId === targetId,
      );
      if (!target || !target.text) {
        throw failure("invalid_answer", "Pick an answer to challenge");
      }
      if (targetId === playerId) {
        throw failure("cannot_challenge_self", "You cannot challenge your own answer");
      }
      const key = `${state.candidates[categoryIndex].category}:${targetId}`;
      if (state.challenges[key]) {
        throw failure("already_challenged", "That answer is already under review");
      }
      state.challenges[key] = {
        key,
        category: state.candidates[categoryIndex].category,
        categoryIndex,
        targetId,
        targetName: target.name,
        text: target.text,
        challengerId: playerId,
        challengerName: room.players.get(playerId)?.name || "Player",
        votes: {},
      };
      if (allChallengesVoted(room, state)) finalizeRound(room, state);
      return undefined;
    }

    if (state.phase === "challenge" && event.type === "voteChallenge") {
      const key = String(event.key || "");
      const challenge = state.challenges[key];
      if (!challenge) throw failure("challenge_missing", "That challenge has closed");
      if (playerId === challenge.targetId) {
        throw failure("answerer_cannot_vote", "The answerer cannot vote on their answer");
      }
      if (challenge.votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted on that answer");
      }
      challenge.votes[playerId] = Boolean(event.accept);
      if (allChallengesVoted(room, state)) finalizeRound(room, state);
      return undefined;
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "answer") {
      beginChallenge(room, state);
      return;
    }
    if (state.phase === "challenge") {
      finalizeRound(room, state);
      return;
    }
    if (state.phase === "compare") {
      return beginRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.answers[playerId];
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "answer" && activePlayers(room).every((player) => state.answers[player.id])) {
      beginChallenge(room, state);
      return;
    }
    if (state.phase === "challenge") {
      for (const [key, challenge] of Object.entries(state.challenges)) {
        if (challenge.targetId === playerId || challenge.challengerId === playerId) {
          delete state.challenges[key];
        }
      }
      if (allChallengesVoted(room, state)) finalizeRound(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const base = {
      phase: state.phase,
      viewerId,
      round: state.round,
      rounds: state.rounds,
      letter: state.letter,
      categories: state.categories,
      submitted: Object.keys(state.answers).length,
      total: activePlayers(room).length,
      myAnswers: state.answers[viewerId] || {},
      answerMs: configFor(MODES, room.mode).answerMs,
      challengeMs: configFor(MODES, room.mode).challengeMs,
      endsAt: state.endsAt,
    };
    if (state.phase === "answer") return base;
    if (state.phase === "challenge") {
      return {
        ...base,
        challengeRows: state.candidates,
        challenges: state.challenges,
        myVotes: Object.fromEntries(
          Object.entries(state.challenges)
            .filter(([, challenge]) => challenge.votes[viewerId] !== undefined)
            .map(([key, challenge]) => [key, challenge.votes[viewerId]]),
        ),
      };
    }
    return { ...base, reveal: state.reveal };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      letter: state.letter,
      submitted: Object.keys(state.answers).length,
      total: activePlayers(room).length,
      endsAt: state.endsAt,
    };
    if (state.phase === "answer") return base;
    if (state.phase === "challenge") {
      return {
        ...base,
        challengeRows: state.candidates,
        challenges: state.challenges,
      };
    }
    return { ...base, reveal: state.reveal };
  },
};

export default scattergories;
