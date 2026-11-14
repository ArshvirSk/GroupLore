import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { teamOf, teamsView } from "../engine/teams.js";
import { normalizeWord } from "../engine/primitives/normalize.js";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const WORDS = require("../data/prompts/codenames.json").map((entry) => entry.text);

const MODES = {
  classic: {
    label: "Classic",
    description: "One clue, one number, unlimited conversation",
    turnMs: 90_000,
    revealMs: 8_000,
  },
  speed: {
    label: "Speed",
    description: "Sixty-second turns and quicker decisions",
    turnMs: 60_000,
    revealMs: 6_000,
  },
};

function makeBoard(startingTeam) {
  const words = shuffle(WORDS).slice(0, 25);
  const colors = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(startingTeam === "team-1" ? "team-2" : "team-1"),
    ...Array(7).fill("neutral"),
    "assassin",
  ];
  const shuffledColors = shuffle(colors);
  return words.map((word, index) => ({
    index,
    word,
    color: shuffledColors[index],
    revealed: false,
  }));
}

function teamById(room, teamId) {
  return (room.teams || []).find((team) => team.id === teamId) || null;
}

function teamPlayers(room, teamId) {
  return (teamById(room, teamId)?.playerIds || [])
    .map((id) => room.players.get(id))
    .filter(Boolean);
}

function foundCount(state, teamId) {
  return state.board.filter(
    (card) => card.revealed && card.color === teamId,
  ).length;
}

function teamWordCount(state, teamId) {
  return state.board.filter((card) => card.color === teamId).length;
}

function assignSpymasters(room, state) {
  state.spymasters = {};
  for (const team of room.teams || []) {
    const players = teamPlayers(room, team.id);
    if (players[0]) state.spymasters[team.id] = players[0].id;
  }
}

function beginTurn(room, state, teamId = state.turnTeamId) {
  const config = configFor(MODES, room.mode);
  state.phase = "clue";
  state.turnTeamId = teamId;
  state.clue = null;
  state.guessesLeft = 0;
  state.endsAt = Date.now() + config.turnMs;
}

function finishGame(room, state, winnerTeamId, reason) {
  for (const team of room.teams || []) {
    const won = team.id === winnerTeamId;
    const found = foundCount(state, team.id);
    for (const playerId of team.playerIds) {
      if (!room.players.has(playerId)) continue;
      const points = won ? 500 : found * 100;
      room.scores[playerId] = Number(room.scores[playerId] || 0) + points;
    }
  }
  state.winnerTeamId = winnerTeamId;
  state.reason = reason;
  state.done = true;
  state.phase = "result";
  state.endsAt = null;
  return "results";
}

function endTurn(room, state) {
  const teams = (room.teams || []).map((team) => team.id);
  const index = teams.indexOf(state.turnTeamId);
  beginTurn(room, state, teams[(index + 1) % teams.length]);
}

const codenames = {
  id: "codenames",
  name: "Codenames",
  description: "Two teams, one spymaster, and a board full of dangerous words.",
  emoji: "🕵️",
  accent: "coral",
  tag: "Strategy",
  teams: { count: 2, minPerTeam: 2 },
  minPlayers: 4,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const startingTeam = Math.random() < 0.5 ? "team-1" : "team-2";
    const otherTeam = startingTeam === "team-1" ? "team-2" : "team-1";
    const state = {
      phase: "clue",
      board: makeBoard(startingTeam),
      startingTeamId: startingTeam,
      turnTeamId: startingTeam,
      otherTeamId: otherTeam,
      spymasters: {},
      clue: null,
      guessesLeft: 0,
      winnerTeamId: null,
      reason: null,
      done: false,
      endsAt: null,
    };
    assignSpymasters(room, state);
    room.state = state;
    beginTurn(room, state, startingTeam);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    const team = teamOf(room, playerId);
    if (state.phase === "clue" && event.type === "clue") {
      if (!team || team.id !== state.turnTeamId) {
        throw failure("wrong_team", "It is the other team's turn");
      }
      if (state.spymasters[team.id] !== playerId) {
        throw failure("spymaster_only", "Only the spymaster gives the clue");
      }
      const word = String(event.word ?? "").trim().slice(0, 30);
      const number = Number(event.number);
      if (!word || word.split(/\s+/).length !== 1) {
        throw failure("one_word", "The clue must be one word");
      }
      const normalized = normalizeWord(word);
      if (
        state.board.some(
          (card) =>
            normalizeWord(card.word) === normalized ||
            normalizeWord(card.word).startsWith(normalized) ||
            normalized.startsWith(normalizeWord(card.word)),
        )
      ) {
        throw failure("clue_on_board", "That word is too close to a board word");
      }
      if (!Number.isInteger(number) || number < 1 || number > 9) {
        throw failure("invalid_number", "Choose a number from 1 to 9");
      }
      state.clue = { word, number, teamId: team.id, playerId };
      state.guessesLeft = number + 1;
      state.phase = "guess";
      state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
      return;
    }

    if (state.phase === "guess" && event.type === "guess") {
      if (!team || team.id !== state.turnTeamId) {
        throw failure("wrong_team", "It is the other team's turn");
      }
      if (state.spymasters[team.id] === playerId) {
        throw failure("spymaster_cannot_guess", "Let your operatives guess");
      }
      const index = Number(event.index);
      const card = state.board[index];
      if (!card) throw failure("invalid_word", "Pick a word on the board");
      if (card.revealed) throw failure("already_revealed", "That word is already revealed");
      card.revealed = true;
      card.revealedBy = playerId;
      if (card.color === "assassin") {
        return finishGame(room, state, state.otherTeamId, "assassin");
      }
      if (card.color === state.turnTeamId) {
        state.guessesLeft -= 1;
        if (foundCount(state, state.turnTeamId) >= teamWordCount(state, state.turnTeamId)) {
          return finishGame(room, state, state.turnTeamId, "all_words");
        }
        if (state.guessesLeft <= 0) endTurn(room, state);
        return;
      }
      endTurn(room, state);
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "clue" || state.phase === "guess") {
      endTurn(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    if (activePlayers(room).length < 4) {
      state.done = true;
      return "results";
    }
    for (const team of room.teams || []) {
      if (state.spymasters[team.id] === playerId) {
        const next = teamPlayers(room, team.id)[0];
        if (next) state.spymasters[team.id] = next.id;
        else {
          state.done = true;
          return "results";
        }
      }
      if (team.playerIds.length < 2) {
        state.done = true;
        return "results";
      }
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const team = teamOf(room, viewerId);
    const isSpymaster = Boolean(team && state.spymasters[team.id] === viewerId);
    const canClue = isSpymaster && state.phase === "clue" && team.id === state.turnTeamId;
    const board = state.board.map((card) => ({
      index: card.index,
      word: card.word,
      revealed: card.revealed,
      color: card.revealed ? card.color : null,
      ...(isSpymaster ? { key: card.color } : {}),
    }));
    return {
      phase: state.phase,
      round: null,
      rounds: null,
      board,
      clue: state.clue,
      guessesLeft: state.guessesLeft,
      turnTeamId: state.turnTeamId,
      yourTeamId: team?.id || null,
      isSpymaster,
      canClue,
      canGuess:
        Boolean(team) &&
        team.id === state.turnTeamId &&
        !isSpymaster &&
        state.phase === "guess" &&
        state.guessesLeft > 0,
      spymasterName: state.spymasters[state.turnTeamId]
        ? room.players.get(state.spymasters[state.turnTeamId])?.name || "Player"
        : null,
      found: Object.fromEntries(
        (room.teams || []).map((item) => [item.id, foundCount(state, item.id)]),
      ),
      remaining: Object.fromEntries(
        (room.teams || []).map((item) => [
          item.id,
          teamWordCount(state, item.id) - foundCount(state, item.id),
        ]),
      ),
      ...teamsView(room),
    };
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase,
      turnTeamId: state.turnTeamId,
      clue: state.clue,
      guessesLeft: state.guessesLeft,
      board: state.board.map((card) => ({
        index: card.index,
        word: card.word,
        revealed: card.revealed,
        color: card.revealed ? card.color : null,
      })),
      ...teamsView(room),
    };
  },
};

export default codenames;
