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
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const STORIES = require("../data/prompts/madLibs.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Three stories, nine blanks, and a room full of bad ideas",
    fillMs: 60_000,
    readMs: 14_000,
    rateMs: 30_000,
    revealMs: 10_000,
    rounds: 3,
  },
};

function beginStory(room, state) {
  state.round += 1;
  state.phase = "fill";
  state.story = choosePrompt(STORIES, state);
  state.reveal = null;
  state.ratings = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).fillMs;

  const players = shuffle(activePlayers(room));
  state.blanks = state.story.blanks.map((blank, index) => ({
    ...blank,
    index,
    playerId: players[index % players.length].id,
    value: "",
  }));
}

function requiredBlanks(room, state) {
  return state.blanks.filter(
    (blank) => blank.playerId && room.players.get(blank.playerId)?.connected,
  );
}

function allFilled(room, state) {
  const blanks = requiredBlanks(room, state);
  return blanks.length > 0 && blanks.every((blank) => blank.value);
}

function enterRead(room, state) {
  state.phase = "read";
  state.endsAt = Date.now() + configFor(MODES, room.mode).readMs;
}

function enterRate(room, state) {
  state.phase = "rate";
  state.endsAt = Date.now() + configFor(MODES, room.mode).rateMs;
  if (allRated(room, state)) resolveRatings(room, state);
}

function rateTargets(room, state, viewerId) {
  return state.blanks.filter(
    (blank) =>
      blank.playerId &&
      blank.playerId !== viewerId &&
      room.players.get(blank.playerId)?.connected &&
      blank.value,
  );
}

function allRated(room, state) {
  return activePlayers(room).every((player) =>
    rateTargets(room, state, player.id).every(
      (blank) => state.ratings[player.id]?.[blank.id] !== undefined,
    ),
  );
}

function segmentsFor(room, state, viewerId, withNames) {
  return state.story.template.split(/(\{\d+\})/g).map((part) => {
    const match = part.match(/^\{(\d+)\}$/);
    if (!match) return { type: "text", text: part };
    const blank = state.blanks[Number(match[1])];
    const owner = blank.playerId ? room.players.get(blank.playerId) : null;
    return {
      type: "blank",
      id: blank.id,
      value: blank.value || "____",
      isMine: blank.playerId === viewerId,
      ...(withNames
        ? {
            playerId: blank.playerId,
            name: owner?.name || "A missing player",
          }
        : {}),
    };
  });
}

function resolveRatings(room, state) {
  const blankRatings = new Map();
  for (const ratings of Object.values(state.ratings)) {
    for (const [blankId, rating] of Object.entries(ratings)) {
      if (!blankRatings.has(blankId)) blankRatings.set(blankId, []);
      blankRatings.get(blankId).push(rating);
    }
  }

  const totals = new Map();
  const counts = new Map();
  for (const blank of state.blanks) {
    if (!blank.playerId) continue;
    for (const rating of blankRatings.get(blank.id) || []) {
      if (!room.players.has(blank.playerId)) continue;
      totals.set(blank.playerId, (totals.get(blank.playerId) || 0) + rating);
      counts.set(blank.playerId, (counts.get(blank.playerId) || 0) + 1);
    }
  }

  const points = new Map();
  for (const [playerId, total] of totals) {
    const average = total / counts.get(playerId);
    addPoints(room, points, playerId, Math.round(average * 100));
  }
  commitPoints(room, points);

  state.reveal = {
    title: state.story.title,
    segments: segmentsFor(room, state, null, true),
    blanks: state.blanks
      .filter((blank) => blank.playerId)
      .map((blank) => {
        const ratings = blankRatings.get(blank.id) || [];
        return {
          id: blank.id,
          value: blank.value || "____",
          playerId: blank.playerId,
          name: room.players.get(blank.playerId)?.name || "A missing player",
          average: ratings.length
            ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
            : 0,
        };
      }),
    roundPoints: pointsList(room, points),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const madLibs = {
  id: "mad-libs",
  name: "Mad Libs Chaos",
  description: "Fill blind blanks, then rate the ridiculous story that appears.",
  emoji: "📝",
  accent: "honey",
  tag: "Story builder",
  minPlayers: 3,
  maxPlayers: 9,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "fill",
      round: 0,
      rounds: configFor(MODES, room.mode).rounds,
      story: null,
      blanks: [],
      ratings: {},
      reveal: null,
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginStory(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "fill" && event.type === "fill") {
      const blankId = String(event.blankId || "");
      const blank = state.blanks.find((item) => item.id === blankId);
      if (!blank || blank.playerId !== playerId) {
        throw failure("not_your_blank", "That blank is not yours");
      }
      const value = String(event.value || "").trim().slice(0, 40);
      if (!value) throw failure("word_required", "Write a word first");
      if (blank.value) throw failure("already_filled", "You already filled that blank");
      blank.value = value;
      if (allFilled(room, state)) enterRead(room, state);
      return;
    }

    if (state.phase === "rate" && event.type === "rate") {
      const blankId = String(event.blankId || "");
      const blank = state.blanks.find((item) => item.id === blankId);
      if (!blank || !blank.playerId || blank.playerId === playerId) {
        throw failure("cannot_rate_own", "You cannot rate your own blank");
      }
      const rating = Number(event.value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw failure("invalid_rating", "Rate from 1 to 5");
      }
      if (!state.ratings[playerId]) state.ratings[playerId] = {};
      if (state.ratings[playerId][blankId] !== undefined) {
        throw failure("already_rated", "You already rated that blank");
      }
      state.ratings[playerId][blankId] = rating;
      if (allRated(room, state)) resolveRatings(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "fill") {
      enterRead(room, state);
      return;
    }
    if (state.phase === "read") {
      enterRate(room, state);
      return;
    }
    if (state.phase === "rate") {
      resolveRatings(room, state);
      return;
    }
    if (state.phase === "reveal") {
      if (state.round >= state.rounds) {
        state.done = true;
        return "results";
      }
      beginStory(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;

    for (const blank of state.blanks) {
      if (blank.playerId === playerId) {
        blank.playerId = null;
        blank.value = "";
      }
    }
    delete state.ratings[playerId];

    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "fill" && allFilled(room, state)) {
      enterRead(room, state);
      return;
    }
    if (state.phase === "rate" && allRated(room, state)) {
      resolveRatings(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);

    if (state.phase === "fill") {
      const mine = state.blanks
        .filter((blank) => blank.playerId === viewerId)
        .map((blank) => ({
          id: blank.id,
          type: blank.type,
          hint: blank.hint,
          value: blank.value,
          submitted: Boolean(blank.value),
        }));
      const blanks = requiredBlanks(room, state);
      return {
        phase: "fill",
        round: state.round,
        rounds: state.rounds,
        title: state.story.title,
        blanks: mine,
        submitted: blanks.filter((blank) => blank.value).length,
        total: blanks.length,
        fillMs: config.fillMs,
      };
    }

    if (state.phase === "read") {
      return {
        phase: "read",
        round: state.round,
        rounds: state.rounds,
        title: state.story.title,
        segments: segmentsFor(room, state, viewerId, false),
      };
    }

    if (state.phase === "rate") {
      const targets = rateTargets(room, state, viewerId).map((blank) => ({
        id: blank.id,
        value: blank.value,
      }));
      const mine = state.ratings[viewerId] || {};
      return {
        phase: "rate",
        round: state.round,
        rounds: state.rounds,
        title: state.story.title,
        segments: segmentsFor(room, state, viewerId, false),
        targets,
        myRatings: mine,
        rated: targets.filter((target) => mine[target.id] !== undefined).length,
        total: targets.length,
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
    if (state.phase === "fill") {
      const blanks = requiredBlanks(room, state);
      return {
        phase: "fill",
        round: state.round,
        rounds: state.rounds,
        title: state.story?.title || "",
        submitted: blanks.filter((blank) => blank.value).length,
        total: blanks.length,
      };
    }
    if (state.phase === "read" || state.phase === "rate") {
      return {
        phase: state.phase,
        round: state.round,
        rounds: state.rounds,
        title: state.story?.title || "",
        segments: segmentsFor(room, state, null, false),
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

export default madLibs;
