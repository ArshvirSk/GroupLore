import { activePlayers, configFor, failure } from "./shared.js";
import { WORD_LIST, isWord } from "../engine/primitives/dictionary.js";
import { normalizeWord } from "../engine/primitives/normalize.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "Three 4×4 boards, ninety seconds each",
    rounds: 3,
    size: 4,
    playMs: 90_000,
    compareMs: 12_000,
    minWords: 8,
  },
  big: {
    label: "Big",
    description: "Three 5×5 boards with two minutes on the clock",
    rounds: 3,
    size: 5,
    playMs: 120_000,
    compareMs: 14_000,
    minWords: 6,
  },
};

const LETTERS = "EEEEEEAAAAAIIIIIOOOOOUUUNNNNRRRRTTTTLLLLSSSSDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";
const WORD_SET = new Set(WORD_LIST);
const PREFIXES = new Set();
for (const word of WORD_LIST) {
  for (let length = 3; length <= word.length; length += 1) {
    PREFIXES.add(word.slice(0, length));
  }
}

function neighbours(index, size) {
  const row = Math.floor(index / size);
  const column = index % size;
  const result = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (!dr && !dc) continue;
      const nextRow = row + dr;
      const nextColumn = column + dc;
      if (nextRow >= 0 && nextRow < size && nextColumn >= 0 && nextColumn < size) {
        result.push(nextRow * size + nextColumn);
      }
    }
  }
  return result;
}

function solveGrid(letters, size) {
  const words = new Set();
  const traveller = (index, path, word) => {
    const next = word + letters[index].toLowerCase();
    if (next.length >= 3 && !PREFIXES.has(next)) return;
    if (next.length >= 3 && WORD_SET.has(next)) words.add(next);
    if (next.length >= 8) return;
    for (const neighbour of neighbours(index, size)) {
      if (path.includes(neighbour)) continue;
      traveller(neighbour, [...path, neighbour], next);
    }
  };
  for (let index = 0; index < letters.length; index += 1) {
    traveller(index, [index], "");
  }
  return [...words];
}

function makeGrid(size, minWords) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const letters = Array.from(
      { length: size * size },
      () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
    );
    const solutions = solveGrid(letters, size);
    if (solutions.length >= minWords) return { letters, solutions };
  }
  return { letters: Array.from({ length: size * size }, () => "E"), solutions: [] };
}

function wordPoints(word) {
  if (word.length >= 8) return 1100;
  if (word.length === 7) return 500;
  if (word.length === 6) return 300;
  if (word.length === 5) return 200;
  return 100;
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  const generated = makeGrid(config.size, config.minWords);
  state.grid = {
    size: config.size,
    letters: generated.letters,
    solutions: generated.solutions,
  };
  state.found = Object.fromEntries(
    activePlayers(room).map((player) => [player.id, []]),
  );
  state.reveal = null;
  state.phase = "play";
  state.endsAt = Date.now() + config.playMs;
  return undefined;
}

function resolveRound(room, state) {
  const config = configFor(MODES, room.mode);
  const counts = new Map();
  for (const entries of Object.values(state.found)) {
    for (const entry of entries) {
      counts.set(entry.word, (counts.get(entry.word) || 0) + 1);
    }
  }
  const pointsByPlayer = {};
  const rows = activePlayers(room).map((player) => {
    const entries = (state.found[player.id] || []).map((entry) => {
      const shared = (counts.get(entry.word) || 0) > 1;
      const points = shared ? 0 : wordPoints(entry.word);
      pointsByPlayer[player.id] = (pointsByPlayer[player.id] || 0) + points;
      return { ...entry, shared, points };
    });
    room.scores[player.id] =
      Number(room.scores[player.id] || 0) + (pointsByPlayer[player.id] || 0);
    return {
      playerId: player.id,
      name: player.name,
      words: entries,
      points: pointsByPlayer[player.id] || 0,
    };
  });
  state.reveal = {
    grid: state.grid,
    counts: [...counts.entries()].map(([word, count]) => ({ word, count })),
    rows,
    roundPoints: rows
      .filter((row) => row.points > 0)
      .map((row) => ({
        playerId: row.playerId,
        name: row.name,
        points: row.points,
      })),
  };
  state.phase = "compare";
  state.endsAt = Date.now() + config.compareMs;
}

const boggleRush = {
  id: "boggle-rush",
  name: "Boggle Rush",
  description: "Trace words on a shared grid before the clock runs out.",
  emoji: "🔠",
  accent: "honey",
  tag: "Real-time",
  minPlayers: 2,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const config = configFor(MODES, room.mode);
    const state = {
      phase: "play",
      round: 0,
      rounds: config.rounds,
      grid: null,
      found: {},
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
    if (state.phase !== "play" || event.type !== "word") return;
    const word = normalizeWord(event.word);
    const path = Array.isArray(event.path) ? event.path.map(Number) : [];
    if (word.length < 3) throw failure("word_too_short", "Use at least three letters");
    if (!isWord(word)) throw failure("not_a_word", "That word is not in the dictionary");
    const size = state.grid.size;
    if (path.length !== word.length) throw failure("invalid_path", "Trace the whole word");
    if (new Set(path).size !== path.length) throw failure("reused_tile", "Do not reuse a tile");
    if (path.some((index) => !Number.isInteger(index) || index < 0 || index >= size * size)) {
      throw failure("invalid_path", "That path leaves the grid");
    }
    const letters = path.map((index) => state.grid.letters[index].toLowerCase()).join("");
    if (letters !== word) throw failure("letters_mismatch", "Those tiles do not spell that word");
    for (let index = 1; index < path.length; index += 1) {
      if (!neighbours(path[index - 1], size).includes(path[index])) {
        throw failure("not_adjacent", "Tiles must touch");
      }
    }
    const entries = state.found[playerId] || [];
    if (entries.some((entry) => entry.word === word)) {
      throw failure("already_found", "You found that word already");
    }
    entries.push({ word, path, points: wordPoints(word) });
    state.found[playerId] = entries;
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "play") {
      resolveRound(room, state);
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
    delete state.found[playerId];
    if (activePlayers(room).length < 2) {
      state.done = true;
      return "results";
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      grid: state.grid,
      myWords: state.found[viewerId] || [],
      counts: Object.fromEntries(
        activePlayers(room).map((player) => [
          player.id,
          (state.found[player.id] || []).length,
        ]),
      ),
      playMs: config.playMs,
    };
    return state.phase === "compare" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    if (state.phase === "play") {
      return {
        phase: "play",
        round: state.round,
        rounds: state.rounds,
        counts: activePlayers(room).map((player) => ({
          playerId: player.id,
          name: player.name,
          count: (state.found[player.id] || []).length,
        })),
      };
    }
    return { phase: state.phase, round: state.round, rounds: state.rounds, reveal: state.reveal };
  },
};

export default boggleRush;
