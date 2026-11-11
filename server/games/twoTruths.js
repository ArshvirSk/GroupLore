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
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const HINTS = require("../data/prompts/twoTruths.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Write two truths and a lie, then see who can spot it",
    writeMs: 60_000,
    voteMs: 20_000,
    revealMs: 9_000,
    rounds: 0,
  },
  rapid: {
    label: "Rapid",
    description: "Fifteen seconds to judge each set",
    writeMs: 60_000,
    voteMs: 15_000,
    revealMs: 7_000,
    rounds: 0,
  },
};

function eligibleVoters(room, subjectId) {
  return activePlayers(room).filter((player) => player.id !== subjectId);
}

function advanceSubject(room, state) {
  while (state.subjectIndex < state.order.length) {
    const subjectId = state.order[state.subjectIndex];
    const submission = state.submissions[subjectId];
    if (!submission || !room.players.get(subjectId)?.connected) {
      state.subjectIndex += 1;
      continue;
    }
    state.subjectId = subjectId;
    state.phase = "vote";
    state.statements = shuffle(
      submission.statements.map((text, index) => ({
        id: randomUUID(),
        text,
        isLie: index === submission.lieIndex,
      })),
    );
    state.votes = {};
    state.reveal = null;
    state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
    return;
  }
  state.done = true;
  return "results";
}

function resolveSubject(room, state) {
  const subject = room.players.get(state.subjectId);
  if (!subject) return advanceSubject(room, state);

  const counts = new Map();
  for (const statementId of Object.values(state.votes)) {
    counts.set(statementId, (counts.get(statementId) || 0) + 1);
  }
  const lie = state.statements.find((statement) => statement.isLie);
  const points = new Map();
  const correctGuessers = [];
  const fooled = [];

  for (const [voterId, statementId] of Object.entries(state.votes)) {
    if (!room.players.get(voterId)?.connected) continue;
    const voter = room.players.get(voterId);
    if (statementId === lie.id) {
      addPoints(room, points, voterId, 100);
      correctGuessers.push({ playerId: voterId, name: voter?.name || "Player" });
    } else {
      addPoints(room, points, state.subjectId, 100);
      fooled.push({ playerId: voterId, name: voter?.name || "Player" });
    }
  }

  commitPoints(room, points);
  state.reveal = {
    subjectId: state.subjectId,
    subjectName: subject.name,
    hint: state.hint?.text || "",
    statements: state.statements.map((statement) => ({
      id: statement.id,
      text: statement.text,
      isLie: statement.isLie,
      votes: counts.get(statement.id) || 0,
    })),
    correctGuessers,
    fooled,
    roundPoints: pointsList(room, points),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const twoTruths = {
  id: "two-truths",
  name: "Two Truths, One Lie",
  description: "Tell two truths and a lie. The room decides which is which.",
  emoji: "🤥",
  accent: "teal",
  tag: "Bluffing",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const players = shuffle(activePlayers(room));
    const state = {
      phase: "write",
      round: 1,
      rounds: players.length,
      order: players.map((player) => player.id),
      subjectIndex: 0,
      subjectId: null,
      hint: choosePrompt(HINTS, { usedPromptIds: [] }),
      submissions: {},
      statements: [],
      votes: {},
      reveal: null,
      usedPromptIds: [],
      done: false,
      endsAt: Date.now() + configFor(MODES, room.mode).writeMs,
    };
    room.state = state;
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "write" && event.type === "submit") {
      if (state.submissions[playerId]) {
        throw failure("already_submitted", "You already submitted your three statements");
      }
      const statements = Array.isArray(event.statements)
        ? event.statements.map((value) => String(value || "").trim().slice(0, 100))
        : [];
      if (statements.length !== 3 || statements.some((text) => !text)) {
        throw failure("three_statements_required", "Write all three statements");
      }
      if (new Set(statements.map((text) => text.toLowerCase())).size !== 3) {
        throw failure("statements_must_differ", "Make all three statements different");
      }
      const lieIndex = Number(event.lieIndex);
      if (!Number.isInteger(lieIndex) || lieIndex < 0 || lieIndex > 2) {
        throw failure("lie_required", "Choose which statement is the lie");
      }
      state.submissions[playerId] = { statements, lieIndex };
      if (activePlayers(room).every((player) => state.submissions[player.id])) {
        advanceSubject(room, state);
      }
      return;
    }

    if (state.phase === "vote" && event.type === "vote") {
      if (playerId === state.subjectId) {
        throw failure("cannot_vote_own", "You cannot vote on your own statements");
      }
      if (state.votes[playerId] !== undefined) {
        throw failure("already_voted", "You already voted");
      }
      const statementId = String(event.statementId || "");
      if (!state.statements.some((statement) => statement.id === statementId)) {
        throw failure("invalid_choice", "That statement is not in play");
      }
      state.votes[playerId] = statementId;
      const voters = eligibleVoters(room, state.subjectId);
      if (voters.every((voter) => state.votes[voter.id] !== undefined)) {
        resolveSubject(room, state);
      }
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";

    if (state.phase === "write") return advanceSubject(room, state);
    if (state.phase === "vote") {
      resolveSubject(room, state);
      return;
    }
    if (state.phase === "reveal") {
      state.subjectIndex += 1;
      return advanceSubject(room, state);
    }
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.submissions[playerId];
    delete state.votes[playerId];
    state.order = state.order.filter((id) => id !== playerId);

    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "write") {
      if (activePlayers(room).every((player) => state.submissions[player.id])) {
        return advanceSubject(room, state);
      }
      return;
    }
    if (state.phase === "vote") {
      if (state.subjectId === playerId) {
        state.subjectIndex += 1;
        return advanceSubject(room, state);
      }
      const voters = eligibleVoters(room, state.subjectId);
      if (voters.every((voter) => state.votes[voter.id] !== undefined)) {
        resolveSubject(room, state);
      }
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    if (state.phase === "write") {
      return {
        phase: "write",
        round: state.round,
        rounds: state.rounds,
        hint: state.hint?.text || "",
        submitted: Object.keys(state.submissions).length,
        total: activePlayers(room).length,
        youSubmitted: Boolean(state.submissions[viewerId]),
        writeMs: configFor(MODES, room.mode).writeMs,
      };
    }
    if (state.phase === "vote") {
      const subject = room.players.get(state.subjectId);
      return {
        phase: "vote",
        round: state.subjectIndex + 1,
        rounds: state.order.length,
        subjectName: subject?.name || "Player",
        statements: state.statements.map((statement) => ({
          id: statement.id,
          text: statement.text,
        })),
        isSubject: viewerId === state.subjectId,
        canVote: viewerId !== state.subjectId,
        myVote: state.votes[viewerId] || null,
        submitted: Object.keys(state.votes).length,
        total: eligibleVoters(room, state.subjectId).length,
      };
    }
    return {
      phase: "reveal",
      round: state.subjectIndex + 1,
      rounds: state.order.length,
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
        hint: state.hint?.text || "",
        submitted: Object.keys(state.submissions).length,
        total: activePlayers(room).length,
      };
    }
    if (state.phase === "vote") {
      return {
        phase: "vote",
        round: state.subjectIndex + 1,
        rounds: state.order.length,
        subjectName: room.players.get(state.subjectId)?.name || "Player",
        statements: state.statements.map((statement) => ({
          id: statement.id,
          text: statement.text,
        })),
        submitted: Object.keys(state.votes).length,
        total: eligibleVoters(room, state.subjectId).length,
      };
    }
    return {
      phase: "reveal",
      round: state.subjectIndex + 1,
      rounds: state.order.length,
      reveal: state.reveal,
    };
  },
};

export default twoTruths;
