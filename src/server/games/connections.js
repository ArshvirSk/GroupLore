import { createRequire } from "node:module";
import {
  activePlayers,
  addPoints,
  configFor,
  failure,
} from "./shared.js";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const PUZZLES = require("../data/prompts/connections.json");

const MODES = {
  race: {
    label: "Race",
    description: "Everyone solves the same 16 words on their own board",
    durationMs: 120_000,
    revealMs: 10_000,
    coOp: false,
  },
  "co-op": {
    label: "Co-op",
    description: "One shared board and four shared mistakes",
    durationMs: 150_000,
    revealMs: 10_000,
    coOp: true,
  },
};

function pickPuzzle(state) {
  if (state.usedPuzzleIds.length >= PUZZLES.length) state.usedPuzzleIds = [];
  let index = Math.floor(Math.random() * PUZZLES.length);
  let guard = 0;
  while (state.usedPuzzleIds.includes(PUZZLES[index].id) && guard < 500) {
    index = Math.floor(Math.random() * PUZZLES.length);
    guard += 1;
  }
  state.usedPuzzleIds.push(PUZZLES[index].id);
  return PUZZLES[index];
}

function wordsFor(puzzle) {
  return puzzle.groups.flatMap((group) => group.words);
}

function makeBoard(puzzle) {
  return {
    words: shuffle(wordsFor(puzzle)),
    solvedLevels: [],
    mistakes: 0,
    done: false,
    last: null,
  };
}

function matchingGroup(puzzle, words) {
  const set = new Set(words.map((word) => word.toLowerCase()));
  return puzzle.groups.find(
    (group) =>
      group.words.length === set.size &&
      group.words.every((word) => set.has(word.toLowerCase())) &&
      [...set].every((word) =>
        group.words.some((candidate) => candidate.toLowerCase() === word),
      ),
  );
}

function oneAwayGroup(puzzle, words, solvedLevels) {
  const set = new Set(words.map((word) => word.toLowerCase()));
  return puzzle.groups.find(
    (group) =>
      !solvedLevels.includes(group.level) &&
      group.words.filter((word) => set.has(word.toLowerCase())).length === 3,
  );
}

function groupById(puzzle, level) {
  return puzzle.groups.find((group) => group.level === level);
}

function resolveGroup(room, state, board, playerId, words) {
  const group = matchingGroup(state.puzzle, words);
  if (!group) {
    board.mistakes += 1;
    board.last = {
      ok: false,
      oneAway: Boolean(oneAwayGroup(state.puzzle, words, board.solvedLevels)),
    };
    if (state.config.coOp && board.mistakes >= 4) {
      state.done = true;
    }
    return "results";
  }
  if (board.solvedLevels.includes(group.level)) {
    throw failure("group_solved", "That group is already solved");
  }
  board.solvedLevels.push(group.level);
  board.last = { ok: true, category: group.category, words: group.words };
  const points = [100, 150, 200, 300][group.level - 1] || 300;
  if (state.config.coOp) {
    for (const player of activePlayers(room)) {
      addPoints(room, state.points, player.id, points);
      room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    }
  } else {
    addPoints(room, state.points, playerId, points);
    room.scores[playerId] = Number(room.scores[playerId] || 0) + points;
  }
  if (board.solvedLevels.length === 4) {
    board.done = true;
    if (!state.config.coOp) {
      addPoints(room, state.points, playerId, 100);
      room.scores[playerId] = Number(room.scores[playerId] || 0) + 100;
    }
  }
  return undefined;
}

const connections = {
  id: "connections",
  name: "Connections",
  description: "Find four groups of four before the board runs out of time.",
  emoji: "🧩",
  accent: "teal",
  tag: "Strategy",
  minPlayers: 2,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "race";
    const state = {
      phase: "solve",
      config: configFor(MODES, room.mode),
      puzzle: null,
      boards: {},
      shared: null,
      reveal: null,
      points: new Map(),
      usedPuzzleIds: [],
      done: false,
      endsAt: null,
    };
    state.puzzle = pickPuzzle(state);
    if (state.config.coOp) {
      state.shared = makeBoard(state.puzzle);
      state.shared.words = shuffle(wordsFor(state.puzzle));
    } else {
      for (const player of activePlayers(room)) {
        state.boards[player.id] = makeBoard(state.puzzle);
      }
    }
    state.endsAt = Date.now() + state.config.durationMs;
    room.state = state;
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "solve" || event.type !== "submitGroup") return;
    const words = Array.isArray(event.words)
      ? event.words.map(String).slice(0, 4)
      : [];
    if (words.length !== 4) throw failure("four_words", "Pick exactly four words");
    const board = state.config.coOp ? state.shared : state.boards[playerId];
    if (!board || board.done) throw failure("board_done", "Your board is finished");
    const all = new Set(board.words.map((word) => word.toLowerCase()));
    if (words.some((word) => !all.has(word.toLowerCase()))) {
      throw failure("unknown_word", "That word is not on the board");
    }
    const outcome = resolveGroup(room, state, board, playerId, words);
    if (outcome === "results") return "results";
    if (state.config.coOp && state.shared.solvedLevels.length === 4) {
      state.phase = "reveal";
      state.endsAt = Date.now() + state.config.revealMs;
      return;
    }
    if (!state.config.coOp && activePlayers(room).every((player) => state.boards[player.id]?.done)) {
      state.phase = "reveal";
      state.endsAt = Date.now() + state.config.revealMs;
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "solve") {
      state.phase = "reveal";
      state.endsAt = Date.now() + state.config.revealMs;
      state.reveal = {
        puzzleId: state.puzzle.id,
        groups: state.puzzle.groups.map((group) => ({
          ...group,
          solvedBy: Object.entries(state.boards)
            .filter(([, board]) => board.solvedLevels.includes(group.level))
            .map(([playerId]) => playerId),
        })),
        boards: Object.entries(state.boards).map(([playerId, board]) => ({
          playerId,
          name: room.players.get(playerId)?.name || "Player",
          solved: board.solvedLevels.length,
          mistakes: board.mistakes,
        })),
        shared: state.shared
          ? {
              solved: state.shared.solvedLevels.length,
              mistakes: state.shared.mistakes,
            }
          : null,
      };
      return;
    }
    if (state.phase === "reveal") {
      state.done = true;
      return "results";
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.boards[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const board = state.config.coOp ? state.shared : state.boards[viewerId];
    const base = {
      phase: state.phase,
      mode: room.mode,
      round: 1,
      rounds: 1,
      solved: board?.solvedLevels.length || 0,
      mistakes: board?.mistakes || 0,
      maxMistakes: state.config.coOp ? 4 : null,
      board: board?.words || [],
      solvedGroups: (board?.solvedLevels || []).map((level) => groupById(state.puzzle, level)),
      last: board?.last || null,
      totalSolved: state.config.coOp
        ? state.shared?.solvedLevels.length || 0
        : activePlayers(room).filter((player) => state.boards[player.id]?.done).length,
    };
    if (state.phase === "reveal") {
      return { ...base, reveal: state.reveal, board: wordsFor(state.puzzle) };
    }
    return base;
  },

  publicFor(room) {
    const state = room.state;
    if (state.phase === "solve") {
      return {
        phase: "solve",
        solved: state.config.coOp
          ? state.shared.solvedLevels.length
          : [...Object.values(state.boards)].filter((board) => board.done).length,
        total: state.config.coOp ? 4 : activePlayers(room).length,
      };
    }
    return { phase: "reveal", reveal: state.reveal };
  },
};

export default connections;
