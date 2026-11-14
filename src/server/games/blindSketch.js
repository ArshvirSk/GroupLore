import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { teamOf, teamsView } from "../engine/teams.js";
import { appendStroke, publicStrokes } from "../engine/primitives/canvas.js";
import { answersMatch } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const WORDS = require("../data/prompts/blindSketch.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Three turns per team, one blind drawing each",
    turnsPerTeam: 3,
    wordMs: 15_000,
    pickMs: 4_000,
    drawMs: 60_000,
    revealMs: 7_000,
  },
  custom: {
    label: "Custom Word",
    description: "The word team writes the word instead of picking a card",
    turnsPerTeam: 3,
    wordMs: 20_000,
    pickMs: 4_000,
    drawMs: 60_000,
    revealMs: 7_000,
  },
  hard: {
    label: "Hard",
    description: "Three turns per team with forty-five seconds to draw",
    turnsPerTeam: 3,
    wordMs: 12_000,
    pickMs: 3_000,
    drawMs: 45_000,
    revealMs: 6_000,
  },
};

function teamPlayers(room, teamId) {
  const team = (room.teams || []).find((item) => item.id === teamId);
  return (team?.playerIds || [])
    .map((id) => room.players.get(id))
    .filter(Boolean);
}

function chooseWords(state, count = 3) {
  if (state.usedWordIds.length >= WORDS.length) state.usedWordIds = [];
  const choices = [];
  let guard = 0;
  while (choices.length < count && guard < 500) {
    guard += 1;
    const index = Math.floor(Math.random() * WORDS.length);
    if (state.usedWordIds.includes(WORDS[index].id)) continue;
    state.usedWordIds.push(WORDS[index].id);
    choices.push(WORDS[index]);
  }
  return choices;
}

function beginReveal(room, state, reason) {
  const config = configFor(MODES, room.mode);
  const points = new Map();
  const add = (playerId, amount) => {
    if (!room.players.has(playerId) || !amount) return;
    points.set(playerId, (points.get(playerId) || 0) + amount);
  };
  if (reason === "correct") {
    const elapsed = Date.now() - state.drawStartedAt;
    const share = Math.max(0.15, 1 - elapsed / Math.max(1, state.drawMs));
    const firstCorrect = state.correctIds[0];
    if (firstCorrect) add(firstCorrect, Math.round(500 * share));
    for (const playerId of state.correctIds.slice(1)) add(playerId, 100);
  } else {
    for (const player of teamPlayers(room, state.wordTeamId)) add(player.id, 300);
  }
  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }
  state.reveal = {
    reason,
    word: state.word?.text || state.customWord || "",
    strokes: publicStrokes(state),
    drawerId: state.drawerId,
    drawerName: room.players.get(state.drawerId)?.name || "Player",
    correctIds: [...state.correctIds],
    correctNames: state.correctIds.map(
      (id) => room.players.get(id)?.name || "Player",
    ),
    roundPoints: [...points.entries()].map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: amount,
    })),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

function beginTurn(room, state) {
  const config = configFor(MODES, room.mode);
  const teams = room.teams || [];
  if (teams.length < 2) {
    state.done = true;
    return "results";
  }
  state.turn += 1;
  const totalTurns = config.turnsPerTeam * 2;
  if (state.turn > totalTurns) {
    state.done = true;
    return "results";
  }
  state.drawingTeamId = teams[(state.turn - 1) % 2].id;
  state.wordTeamId = teams[(state.turn - 1) % 2 === 0 ? 1 : 0].id;
  state.drawerId = null;
  state.word = null;
  state.customWord = null;
  state.choices = chooseWords(state);
  state.strokes = [];
  state.correctIds = [];
  state.guesses = {};
  state.reveal = null;
  state.phase = "word";
  state.endsAt = Date.now() + config.wordMs;
  return undefined;
}

function beginPick(room, state, chosenWord) {
  const config = configFor(MODES, room.mode);
  state.word = chosenWord;
  state.phase = "pick-drawer";
  state.endsAt = Date.now() + config.pickMs;
  state.drawerCandidates = teamPlayers(room, state.drawingTeamId).map(
    (player) => player.id,
  );
  state.drawerIndex = state.turn % Math.max(1, state.drawerCandidates.length);
  return undefined;
}

function beginDraw(room, state) {
  const config = configFor(MODES, room.mode);
  if (!state.drawerId) {
    state.drawerId = state.drawerCandidates[state.drawerIndex] || state.drawerCandidates[0] || null;
  }
  if (!state.drawerId) {
    state.done = true;
    return "results";
  }
  state.phase = "draw";
  state.drawStartedAt = Date.now();
  state.drawMs = config.drawMs;
  state.endsAt = state.drawStartedAt + config.drawMs;
  return undefined;
}

const blindSketch = {
  id: "blind-sketch",
  name: "Blind Sketch",
  description: "Draw a word you can see, but your team only sees the strokes.",
  emoji: "🙈",
  accent: "blue",
  tag: "Draw",
  teams: { count: 2, minPerTeam: 2 },
  minPlayers: 4,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const state = {
      phase: "word",
      turn: 0,
      drawingTeamId: null,
      wordTeamId: null,
      drawerId: null,
      drawerCandidates: [],
      word: null,
      customWord: null,
      choices: [],
      strokes: [],
      guesses: {},
      correctIds: [],
      reveal: null,
      usedWordIds: [],
      done: false,
      endsAt: null,
      drawStartedAt: 0,
      drawMs: 0,
    };
    room.state = state;
    beginTurn(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    const team = teamOf(room, playerId);
    if (state.phase === "word" && event.type === "chooseWord") {
      if (!team || team.id !== state.wordTeamId) {
        throw failure("word_team_only", "Only the word team picks the word");
      }
      if (room.mode === "custom") {
        const custom = String(event.value ?? "").trim().slice(0, 30);
        if (!custom || custom.split(/\s+/).length > 3) {
          throw failure("invalid_word", "Write a short word or phrase");
        }
        state.customWord = custom;
        return beginPick(room, state, { id: "custom", text: custom });
      }
      const choice = state.choices.find((item) => item.id === String(event.wordId || ""));
      if (!choice) throw failure("invalid_word", "Pick one of the three words");
      return beginPick(room, state, choice);
    }
    if (state.phase === "pick-drawer" && event.type === "pickDrawer") {
      if (!team || team.id !== state.drawingTeamId) {
        throw failure("drawing_team_only", "Only the drawing team picks the drawer");
      }
      const pick = String(event.playerId || "");
      if (!state.drawerCandidates.includes(pick)) {
        throw failure("invalid_drawer", "Pick a teammate");
      }
      state.drawerId = pick;
      return beginDraw(room, state);
    }
    if (state.phase === "draw" && event.type === "stroke") {
      if (playerId !== state.drawerId) {
        throw failure("drawer_only", "Only the drawer can draw");
      }
      return appendStroke(state, event.stroke);
    }
    if (state.phase === "draw" && event.type === "guess") {
      if (!team || team.id !== state.drawingTeamId || playerId === state.drawerId) {
        throw failure("guesser_only", "Only the drawing team can guess");
      }
      const guess = String(event.value ?? "").trim().slice(0, 80);
      if (!guess) throw failure("guess_required", "Type a guess");
      const guesses = state.guesses[playerId] || [];
      if (guesses.length >= 3) throw failure("too_many_guesses", "No more guesses");
      guesses.push(guess);
      state.guesses[playerId] = guesses;
      if (answersMatch(guess, state.word.text)) {
        if (!state.correctIds.includes(playerId)) state.correctIds.push(playerId);
        const teammates = teamPlayers(room, state.drawingTeamId).filter(
          (player) => player.id !== state.drawerId,
        );
        if (teammates.every((player) => state.correctIds.includes(player.id))) {
          beginReveal(room, state, "correct");
        }
      }
      return undefined;
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "word") {
      if (room.mode === "custom") {
        const fallback = state.choices[0];
        return beginPick(room, state, { id: fallback.id, text: fallback.text });
      }
      return beginPick(room, state, state.choices[0]);
    }
    if (state.phase === "pick-drawer") {
      state.drawerId =
        state.drawerCandidates[state.drawerIndex] || state.drawerCandidates[0];
      return beginDraw(room, state);
    }
    if (state.phase === "draw") {
      beginReveal(room, state, state.correctIds.length ? "correct" : "timeout");
      return;
    }
    if (state.phase === "reveal") {
      return beginTurn(room, state);
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
      if (team.playerIds.length < 2) {
        state.done = true;
        return "results";
      }
    }
    if (playerId === state.drawerId) {
      const next = state.drawerCandidates.find((id) => id !== playerId);
      state.drawerId = next || null;
      if (!state.drawerId) {
        state.done = true;
        return "results";
      }
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const team = teamOf(room, viewerId);
    const isDrawer = viewerId === state.drawerId;
    const isWordTeam = team?.id === state.wordTeamId;
    const isDrawingTeam = team?.id === state.drawingTeamId;
    const base = {
      phase: state.phase,
      round: state.turn,
      rounds: null,
      drawingTeamId: state.drawingTeamId,
      wordTeamId: state.wordTeamId,
      yourTeamId: team?.id || null,
      isDrawer,
      isWordTeam,
      isDrawingTeam,
      word: isDrawer || isWordTeam || state.phase === "reveal" ? state.word?.text || null : null,
      choices: state.phase === "word" && isWordTeam ? state.choices : [],
      drawerName: room.players.get(state.drawerId)?.name || null,
      drawerCandidates:
        state.phase === "pick-drawer" && isDrawingTeam ? state.drawerCandidates : [],
      strokes: isDrawer ? [] : publicStrokes(state),
      myGuesses: state.guesses[viewerId] || [],
      correctNames: state.correctIds.map(
        (id) => room.players.get(id)?.name || "Player",
      ),
      ...teamsView(room),
    };
    if (state.phase === "reveal") return { ...base, reveal: state.reveal };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.turn,
      drawingTeamId: state.drawingTeamId,
      wordTeamId: state.wordTeamId,
      strokes: publicStrokes(state),
      ...teamsView(room),
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default blindSketch;
