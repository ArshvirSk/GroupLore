import { randomUUID } from "node:crypto";
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
const TOPICS = require("../data/prompts/acronymWars.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Five rounds with 40 seconds to expand the letters",
    writeMs: 40_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 5,
  },
  speed: {
    label: "Speed",
    description: "Five rounds with 20 seconds on the clock",
    writeMs: 20_000,
    voteMs: 12_000,
    revealMs: 7_000,
    rounds: 5,
  },
};

const VOWELS = "AEIOU";
const COMMON = "BCDFGHJKLMNPRSTWY";
const RARE = "QXVZ";

function makeLetters() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const count = 3 + Math.floor(Math.random() * 3);
    const letters = [];
    while (letters.length < count) {
      const pool = Math.random() < 0.35 ? VOWELS : Math.random() < 0.88 ? COMMON : RARE;
      const letter = pool[Math.floor(Math.random() * pool.length)];
      if (!letters.includes(letter)) letters.push(letter);
    }
    const hasVowel = letters.some((letter) => VOWELS.includes(letter));
    const rareCount = letters.filter((letter) => RARE.includes(letter)).length;
    if (hasVowel && rareCount <= 1) return letters;
  }
  return ["B", "A", "R", "K"];
}

function beginRound(room, state) {
  state.round += 1;
  state.phase = "write";
  state.letters = makeLetters();
  state.topic = Math.random() < 0.7 ? choosePrompt(TOPICS, state) : null;
  state.submissions = {};
  state.choices = [];
  state.votes = {};
  state.reveal = null;
  state.roundPoints = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).writeMs;
}

function validateExpansion(letters, raw) {
  const words = String(raw || "").trim().split(/\s+/).filter(Boolean);
  if (words.length !== letters.length) {
    throw failure(
      "wrong_word_count",
      `Use exactly ${letters.length} words, one for each letter`,
    );
  }
  words.forEach((word, index) => {
    const first = word.replace(/[^a-z]/gi, "").charAt(0).toUpperCase();
    if (first !== letters[index]) {
      throw failure(
        "wrong_letter",
        `Word ${index + 1} must start with ${letters[index]}`,
      );
    }
  });
  return words;
}

function buildChoices(room, state) {
  state.choices = Object.entries(state.submissions)
    .filter(([playerId]) => room.players.get(playerId)?.connected)
    .map(([playerId, submission]) => ({
      id: randomUUID(),
      playerId,
      text: submission.text,
      words: submission.words,
    }));

  state.phase = "vote";
  state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
  if (state.choices.length <= 1) resolveVotes(room, state);
}

function resolveVotes(room, state) {
  const points = new Map();
  const eligible = activePlayers(room);
  for (const submission of Object.values(state.submissions)) {
    addPoints(room, points, submission.playerId, 25);
  }

  const counts = new Map();
  for (const [voterId, choiceId] of Object.entries(state.votes)) {
    if (!room.players.get(voterId)?.connected) continue;
    const choice = state.choices.find((item) => item.id === choiceId);
    if (!choice || choice.playerId === voterId) continue;
    counts.set(choiceId, (counts.get(choiceId) || 0) + 1);
  }

  for (const choice of state.choices) {
    const received = counts.get(choice.id) || 0;
    addPoints(room, points, choice.playerId, received * 100);
    if (received > 0 && received === eligible.length - 1) {
      addPoints(room, points, choice.playerId, 200);
    }
  }

  commitPoints(room, points);
  state.roundPoints = Object.fromEntries(points);
  state.reveal = {
    acronym: state.letters.join(""),
    topic: state.topic?.text || null,
    choices: state.choices
      .map((choice) => ({
        id: choice.id,
        text: choice.text,
        playerId: choice.playerId,
        name: room.players.get(choice.playerId)?.name || "Player",
        votes: counts.get(choice.id) || 0,
        points: points.get(choice.playerId) || 0,
      }))
      .sort((a, b) => b.votes - a.votes || b.points - a.points),
    roundPoints: pointsList(room, points),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const acronymWars = {
  id: "acronym-wars",
  name: "Acronym Wars",
  description: "Turn random letters into the expansion the room likes best.",
  emoji: "🔤",
  accent: "teal",
  tag: "Word game",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "write",
      round: 0,
      rounds: configFor(MODES, room.mode).rounds,
      letters: [],
      topic: null,
      submissions: {},
      choices: [],
      votes: {},
      reveal: null,
      roundPoints: {},
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

    if (state.phase === "write" && event.type === "answer") {
      if (state.submissions[playerId]) {
        throw failure("already_answered", "You already submitted an expansion");
      }
      const text = String(event.value || "").trim().slice(0, 100);
      if (!text) throw failure("answer_required", "Write an expansion first");
      const words = validateExpansion(state.letters, text);
      state.submissions[playerId] = { playerId, text, words };
      if (activePlayers(room).every((player) => state.submissions[player.id])) {
        buildChoices(room, state);
      }
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (state.votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted");
      }
      const choiceId = String(event.choiceId || "");
      const choice = state.choices.find((item) => item.id === choiceId);
      if (!choice) throw failure("invalid_choice", "That expansion is not in play");
      if (choice.playerId === playerId) {
        throw failure("cannot_vote_own", "You cannot vote for your own expansion");
      }
      state.votes[playerId] = choiceId;
      if (activePlayers(room).every((player) => state.votes[player.id])) {
        resolveVotes(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "write") {
      buildChoices(room, state);
      return;
    }
    if (state.phase === "vote") {
      resolveVotes(room, state);
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
    delete state.submissions[playerId];
    delete state.votes[playerId];

    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (
      state.phase === "write" &&
      activePlayers(room).every((player) => state.submissions[player.id])
    ) {
      buildChoices(room, state);
      return;
    }
    if (state.phase === "vote") {
      if (state.choices.some((choice) => choice.playerId === playerId)) {
        state.choices = state.choices.filter((choice) => choice.playerId !== playerId);
      }
      if (activePlayers(room).every((player) => state.votes[player.id])) {
        resolveVotes(room, state);
      }
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);

    if (state.phase === "write") {
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        letters: state.letters,
        topic: state.topic?.text || null,
        submitted: Object.keys(state.submissions).length,
        total: activePlayers(room).length,
        youSubmitted: Boolean(state.submissions[viewerId]),
        writeMs: config.writeMs,
      };
    }

    if (state.phase === "vote") {
      const mine = state.choices.find((choice) => choice.playerId === viewerId);
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        letters: state.letters,
        topic: state.topic?.text || null,
        choices: state.choices.map((choice) => ({ id: choice.id, text: choice.text })),
        myChoiceId: mine?.id || null,
        myVote: state.votes[viewerId] || null,
        submitted: Object.keys(state.votes).length,
        total: activePlayers(room).length,
      };
    }

    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      reveal: state.reveal,
    };
  },

  publicFor(room) {
    const state = room.state;
    if (state.phase === "write") {
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        letters: state.letters,
        topic: state.topic?.text || null,
        submitted: Object.keys(state.submissions).length,
        total: activePlayers(room).length,
      };
    }
    if (state.phase === "vote") {
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        letters: state.letters,
        topic: state.topic?.text || null,
        choices: state.choices.map((choice) => ({ id: choice.id, text: choice.text })),
        submitted: Object.keys(state.votes).length,
        total: activePlayers(room).length,
      };
    }
    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      reveal: state.reveal,
    };
  },
};

export default acronymWars;
