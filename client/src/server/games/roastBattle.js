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
const PROMPTS = require("../data/prompts/roastBattle.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Three rounds, 45 seconds to write, 20 seconds per duel",
    writeMs: 45_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 3,
  },
  quick: {
    label: "Quick",
    description: "Two faster rounds with shorter duels",
    writeMs: 30_000,
    voteMs: 15_000,
    revealMs: 7_000,
    rounds: 2,
  },
};

function beginRound(room, state) {
  state.round += 1;
  state.phase = "write";
  state.matchups = [];
  state.assignments = {};
  state.answers = {};
  state.votes = {};
  state.matchupIndex = 0;
  state.reveal = null;
  state.roundPoints = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).writeMs;

  const players = activePlayers(room);
  const matchupCount = Math.ceil(players.length / 2);
  for (let index = 0; index < matchupCount; index += 1) {
    const first = players[(index * 2) % players.length];
    const second = players[(index * 2 + 1) % players.length];
    const prompt = choosePrompt(PROMPTS, state);
    const matchup = {
      id: randomUUID(),
      prompt,
      entries: [],
      resolved: false,
      reveal: null,
    };
    state.matchups.push(matchup);
    for (const player of [first, second]) {
      const slotId = randomUUID();
      state.assignments[slotId] = {
        playerId: player.id,
        matchupId: matchup.id,
        prompt: prompt.text,
      };
      matchup.entries.push({ id: slotId, playerId: player.id });
    }
  }
}

function requiredSlots(room, state) {
  return Object.entries(state.assignments).filter(([, slot]) =>
    room.players.get(slot.playerId)?.connected,
  );
}

function allAnswersIn(room, state) {
  const slots = requiredSlots(room, state);
  return slots.length > 0 && slots.every(([slotId]) => state.answers[slotId]);
}

function eligibleVoters(room, matchup) {
  const authors = new Set(matchup.entries.map((entry) => entry.playerId));
  return activePlayers(room).filter((player) => !authors.has(player.id));
}

function startDuels(room, state) {
  for (const matchup of state.matchups) {
    matchup.entries = matchup.entries.map((entry) => ({
      ...entry,
      text: String(state.answers[entry.id] || "").trim(),
      forfeited: !state.answers[entry.id],
    }));
    state.votes[matchup.id] = {};
  }
  state.phase = "duel";
  state.matchupIndex = 0;
  advanceToNextMatchup(room, state);
}

function advanceToNextMatchup(room, state) {
  while (
    state.matchupIndex < state.matchups.length &&
    state.matchups[state.matchupIndex].resolved
  ) {
    state.matchupIndex += 1;
  }
  if (state.matchupIndex >= state.matchups.length) {
    state.phase = "reveal";
    state.reveal = {
      matchups: state.matchups.map((matchup) => matchup.reveal),
      roundPoints: pointsList(room, new Map(Object.entries(state.roundPoints))),
    };
    state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
    return;
  }
  state.phase = "duel";
  state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
}

function resolveCurrentMatchup(room, state) {
  const matchup = state.matchups[state.matchupIndex];
  if (!matchup || matchup.resolved) return;

  const votes = state.votes[matchup.id] || {};
  const eligible = eligibleVoters(room, matchup);
  const tally = new Map();
  for (const voter of eligible) {
    const slotId = votes[voter.id];
    if (matchup.entries.some((entry) => entry.id === slotId && !entry.forfeited)) {
      tally.set(slotId, (tally.get(slotId) || 0) + 1);
    }
  }

  const points = new Map();
  const answered = matchup.entries.filter((entry) => !entry.forfeited);
  const totalVotes = [...tally.values()].reduce((sum, count) => sum + count, 0);

  if (answered.length === 1) {
    addPoints(room, points, answered[0].playerId, 100);
  } else if (answered.length === 2 && totalVotes > 0) {
    for (const entry of answered) {
      const received = tally.get(entry.id) || 0;
      addPoints(room, points, entry.playerId, received * 100);
    }
    const unanimous = answered.find((entry) => (tally.get(entry.id) || 0) === totalVotes);
    if (unanimous) addPoints(room, points, unanimous.playerId, 300);
  }

  for (const [playerId, amount] of points) {
    state.roundPoints[playerId] = (state.roundPoints[playerId] || 0) + amount;
  }
  commitPoints(room, points);

  matchup.resolved = true;
  matchup.reveal = {
    id: matchup.id,
    prompt: matchup.prompt.text,
    entries: matchup.entries.map((entry) => ({
      id: entry.id,
      text: entry.text || "No answer",
      forfeited: entry.forfeited,
      playerId: entry.playerId,
      name: room.players.get(entry.playerId)?.name || "Player",
      votes: tally.get(entry.id) || 0,
      points: points.get(entry.playerId) || 0,
    })),
    voters: eligible.length,
  };
  advanceToNextMatchup(room, state);
}

const roastBattle = {
  id: "roast-battle",
  name: "Roast Battle",
  description: "Write the sharpest answer, then win the head-to-head vote.",
  emoji: "🔥",
  accent: "pink",
  tag: "Head to head",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "write",
      round: 0,
      rounds: configFor(MODES, room.mode).rounds,
      matchups: [],
      assignments: {},
      answers: {},
      votes: {},
      matchupIndex: 0,
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
      const slotId = String(event.slotId || "");
      const slot = state.assignments[slotId];
      if (!slot || slot.playerId !== playerId) {
        throw failure("not_your_prompt", "That prompt is not yours");
      }
      if (state.answers[slotId] !== undefined) {
        throw failure("already_answered", "You already answered that prompt");
      }
      const text = String(event.value || "").trim().slice(0, 80);
      if (!text) throw failure("answer_required", "Write an answer first");
      state.answers[slotId] = text;
      if (allAnswersIn(room, state)) startDuels(room, state);
      return;
    }

    if (state.phase === "duel" && event.type === "vote") {
      const matchup = state.matchups[state.matchupIndex];
      if (!matchup || matchup.resolved) return;
      if (matchup.entries.some((entry) => entry.playerId === playerId)) {
        throw failure("cannot_vote_own_duel", "You cannot vote in your own duel");
      }
      const votes = state.votes[matchup.id] || (state.votes[matchup.id] = {});
      if (votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted in this duel");
      }
      const slotId = String(event.slotId || "");
      const entry = matchup.entries.find((item) => item.id === slotId && !item.forfeited);
      if (!entry) throw failure("invalid_choice", "That answer is not in this duel");
      votes[playerId] = slotId;
      const eligible = eligibleVoters(room, matchup);
      if (eligible.every((voter) => votes[voter.id] !== undefined)) {
        resolveCurrentMatchup(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "write") {
      startDuels(room, state);
      return;
    }
    if (state.phase === "duel") {
      resolveCurrentMatchup(room, state);
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
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }

    for (const [slotId, slot] of Object.entries(state.assignments)) {
      if (slot.playerId === playerId) delete state.answers[slotId];
    }
    for (const matchup of state.matchups) {
      const votes = state.votes[matchup.id];
      if (votes) delete votes[playerId];
      const entry = matchup.entries.find((item) => item.playerId === playerId);
      if (entry) {
        entry.text = "";
        entry.forfeited = true;
      }
    }

    if (state.phase === "write" && allAnswersIn(room, state)) {
      startDuels(room, state);
      return;
    }
    if (state.phase === "duel") {
      const matchup = state.matchups[state.matchupIndex];
      if (!matchup) return;
      const wasAuthor = matchup.entries.some((entry) => entry.playerId === playerId);
      const votes = state.votes[matchup.id] || {};
      const eligible = eligibleVoters(room, matchup);
      if (wasAuthor || eligible.every((voter) => votes[voter.id] !== undefined)) {
        resolveCurrentMatchup(room, state);
      }
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);

    if (state.phase === "write") {
      const assignments = Object.entries(state.assignments)
        .filter(([, slot]) => slot.playerId === viewerId)
        .map(([slotId, slot]) => ({
          slotId,
          prompt: slot.prompt,
          submitted: state.answers[slotId] !== undefined,
        }));
      const slots = requiredSlots(room, state);
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        assignments,
        submitted: slots.filter(([slotId]) => state.answers[slotId]).length,
        total: slots.length,
        writeMs: config.writeMs,
      };
    }

    if (state.phase === "duel") {
      const matchup = state.matchups[state.matchupIndex];
      if (!matchup) return this.viewFor(room, viewerId);
      const votes = state.votes[matchup.id] || {};
      const eligible = eligibleVoters(room, matchup);
      const isAuthor = matchup.entries.some((entry) => entry.playerId === viewerId);
      return {
        phase: "duel",
        round: state.round,
        rounds: state.rounds,
        index: state.matchupIndex + 1,
        total: state.matchups.length,
        matchup: {
          prompt: matchup.prompt.text,
          answers: matchup.entries.map((entry) => ({ id: entry.id, text: entry.text })),
        },
        isAuthor,
        canVote: !isAuthor,
        myVote: votes[viewerId] || null,
        submitted: eligible.filter((voter) => votes[voter.id] !== undefined).length,
        totalVoters: eligible.length,
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
      const slots = requiredSlots(room, state);
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        submitted: slots.filter(([slotId]) => state.answers[slotId]).length,
        total: slots.length,
      };
    }
    if (state.phase === "duel") {
      const matchup = state.matchups[state.matchupIndex];
      const eligible = matchup ? eligibleVoters(room, matchup) : [];
      const votes = matchup ? state.votes[matchup.id] || {} : {};
      return {
        phase: "duel",
        round: state.round,
        rounds: state.rounds,
        index: state.matchupIndex + 1,
        total: state.matchups.length,
        matchup: matchup
          ? {
              prompt: matchup.prompt.text,
              answers: matchup.entries.map((entry) => ({ id: entry.id, text: entry.text })),
            }
          : null,
        submitted: eligible.filter((voter) => votes[voter.id] !== undefined).length,
        totalVoters: eligible.length,
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

export default roastBattle;
