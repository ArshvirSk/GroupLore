import { createRequire } from "node:module";
import {
  activePlayers,
  configFor,
  failure,
} from "./shared.js";
import { teamOf, teamsView } from "../engine/teams.js";
import { normalizeText, normalizeWord } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const WORDS = require("../data/prompts/password.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Five words per team, sixty seconds, three clues",
    wordsPerTeam: 5,
    turnMs: 60_000,
    resultMs: 5_000,
    maxClues: 3,
  },
  speed: {
    label: "Speed",
    description: "Five words per team with a forty-five second clock",
    wordsPerTeam: 5,
    turnMs: 45_000,
    resultMs: 4_000,
    maxClues: 3,
  },
};

const PAUSE_MS = 20_000;

function connectedTeamPlayers(room, team) {
  return (team?.playerIds || [])
    .map((id) => room.players.get(id))
    .filter((player) => player?.connected);
}

function teamsReady(room) {
  return (
    activePlayers(room).length >= 4 &&
    (room.teams || []).length >= 2 &&
    (room.teams || []).every((team) => connectedTeamPlayers(room, team).length >= 2)
  );
}

function pauseForDropout(room, state, team) {
  const config = configFor(MODES, room.mode);
  if (state.phase === "paused") {
    state.endsAt = Date.now() + PAUSE_MS;
    return;
  }
  state.pausedFrom = state.phase;
  state.pauseRemainingMs = Math.max(
    0,
    Math.min(
      Number(state.endsAt || 0) - Date.now(),
      state.phase === "result" ? config.resultMs : config.turnMs,
    ),
  );
  state.pauseTeamId = team?.id || state.currentTeamId;
  state.pauseReason = "A team is waiting for a player to reconnect";
  state.phase = "paused";
  state.endsAt = Date.now() + PAUSE_MS;
}

function resumeFromPause(room, state) {
  if (state.phase !== "paused" || !teamsReady(room)) return false;
  const config = configFor(MODES, room.mode);
  const from = state.pausedFrom || "turn";
  state.pausedFrom = null;
  state.pauseTeamId = null;
  state.pauseReason = null;
  if (from === "result" && state.result) {
    state.phase = "result";
    state.endsAt = Date.now() + config.resultMs;
    state.pauseRemainingMs = 0;
    return true;
  }
  const team = (room.teams || []).find((item) => item.id === state.currentTeamId);
  const players = connectedTeamPlayers(room, team);
  if (players.length < 2) return false;
  if (!players.some((player) => player.id === state.clueGiverId)) {
    state.clueGiverId = players[0].id;
  }
  state.phase = "turn";
  state.endsAt =
    Date.now() +
    Math.max(
      10_000,
      Math.min(state.pauseRemainingMs || config.turnMs, config.turnMs),
    );
  state.pauseRemainingMs = 0;
  return true;
}

function chooseWord(state) {
  if (state.usedWordIds.length >= WORDS.length) state.usedWordIds = [];
  let index = Math.floor(Math.random() * WORDS.length);
  let guard = 0;
  while (state.usedWordIds.includes(WORDS[index].id) && guard < 500) {
    index = Math.floor(Math.random() * WORDS.length);
    guard += 1;
  }
  state.usedWordIds.push(WORDS[index].id);
  return WORDS[index];
}

function teamPlayers(room, team) {
  return (team?.playerIds || [])
    .map((id) => room.players.get(id))
    .filter((player) => player && player.connected);
}

function beginTurn(room, state) {
  const config = configFor(MODES, room.mode);
  const teams = room.teams || [];
  if (teams.length < 2) {
    state.done = true;
    return "results";
  }
  state.teamIndex = state.teamIndex % teams.length;
  const team = teams[state.teamIndex];
  const turns = state.turnsByTeam[team.id] || 0;
  if (turns >= config.wordsPerTeam) {
    state.teamIndex += 1;
    if ((state.turnsByTeam[teams[state.teamIndex % teams.length].id] || 0) >= config.wordsPerTeam) {
      state.done = true;
      return "results";
    }
    return beginTurn(room, state);
  }
  const players = teamPlayers(room, team);
  if (players.length < 2) {
    state.done = true;
    return "results";
  }
  state.phase = "turn";
  state.currentTeamId = team.id;
  state.clueGiverId = players[turns % players.length].id;
  state.word = chooseWord(state);
  state.clues = [];
  state.wrongThisClue = [];
  state.guesses = {};
  state.result = null;
  state.endsAt = Date.now() + config.turnMs;
  return undefined;
}

function resolveTurn(room, state, correct, guesserId = null) {
  const config = configFor(MODES, room.mode);
  const team = (room.teams || []).find((item) => item.id === state.currentTeamId);
  let points = 0;
  if (correct) {
    points = [300, 200, 100][Math.max(0, state.clues.length - 1)] || 100;
    for (const player of teamPlayers(room, team)) {
      room.scores[player.id] = Number(room.scores[player.id] || 0) + points;
    }
  }
  state.result = {
    correct,
    word: state.word.text,
    points,
    guesserId,
    guesserName: guesserId ? room.players.get(guesserId)?.name || "Player" : null,
    clueGiverId: state.clueGiverId,
    clueGiverName: room.players.get(state.clueGiverId)?.name || "Player",
    clues: [...state.clues],
    teamId: team?.id || null,
    teamName: team?.name || "Team",
    roundPoints: teamPlayers(room, team).map((player) => ({
      playerId: player.id,
      name: player.name,
      points: correct ? points : 0,
    })),
  };
  state.turnsByTeam[team.id] = (state.turnsByTeam[team.id] || 0) + 1;
  state.phase = "result";
  state.endsAt = Date.now() + config.resultMs;
  return undefined;
}

const password = {
  id: "password",
  name: "Password",
  description: "Give one-word clues without saying the secret word.",
  emoji: "🔤",
  accent: "blue",
  tag: "Social",
  teams: { count: 2, minPerTeam: 2 },
  minPlayers: 4,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const teams = room.teams || [];
    const state = {
      phase: "turn",
      playerTeams: Object.fromEntries(
        teams.flatMap((team) => team.playerIds.map((id) => [id, team.id])),
      ),
      teamIndex: 0,
      turnsByTeam: Object.fromEntries(teams.map((team) => [team.id, 0])),
      currentTeamId: null,
      clueGiverId: null,
      word: null,
      clues: [],
      wrongThisClue: [],
      guesses: {},
      result: null,
      usedWordIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginTurn(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "paused" && !resumeFromPause(room, state)) {
      return undefined;
    }
    if (state.phase !== "turn") return;
    const team = (room.teams || []).find((item) => item.id === state.currentTeamId);
    if (!team?.playerIds.includes(playerId)) {
      throw failure("wrong_team", "Wait for your team's turn");
    }
    if (event.type === "clue") {
      if (playerId !== state.clueGiverId) {
        throw failure("clue_giver_only", "Only the clue giver can send a clue");
      }
      const clue = String(event.value ?? "").trim().slice(0, 40);
      if (!clue || clue.split(/\s+/).length !== 1) {
        throw failure("one_word", "Use exactly one word");
      }
      const target = normalizeWord(state.word.text);
      const normalized = normalizeWord(clue);
      if (
        normalized === target ||
        target.startsWith(normalized) ||
        normalized.startsWith(target)
      ) {
        throw failure("clue_leaks_word", "That clue is too close to the word");
      }
      if (state.clues.some((item) => normalizeWord(item) === normalized)) {
        throw failure("duplicate_clue", "You already used that clue");
      }
      state.clues.push(clue);
      state.wrongThisClue = [];
      if (state.clues.length > configFor(MODES, room.mode).maxClues) {
        resolveTurn(room, state, false);
      }
      return;
    }
    if (event.type === "guess") {
      if (playerId === state.clueGiverId) {
        throw failure("clue_giver_cannot_guess", "Let your team guess");
      }
      if (state.wrongThisClue.includes(playerId)) {
        throw failure("wait_for_clue", "Wait for the next clue");
      }
      const guess = String(event.value ?? "").trim();
      if (!guess) throw failure("guess_required", "Type a guess");
      state.guesses[playerId] = guess;
      if (normalizeText(guess) === normalizeText(state.word.text)) {
        return resolveTurn(room, state, true, playerId);
      }
      state.wrongThisClue.push(playerId);
      const guessers = teamPlayers(room, team).filter(
        (player) => player.id !== state.clueGiverId,
      );
      if (
        state.clues.length >= configFor(MODES, room.mode).maxClues &&
        guessers.every((player) => state.wrongThisClue.includes(player.id))
      ) {
        resolveTurn(room, state, false);
      }
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "paused") {
      if (resumeFromPause(room, state)) return undefined;
      state.done = true;
      return "results";
    }
    if (state.phase === "turn") {
      resolveTurn(room, state, false);
      return;
    }
    if (state.phase === "result") {
      state.teamIndex += 1;
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
    const team =
      (room.teams || []).find(
        (item) => item.id === state.playerTeams?.[playerId],
      ) || teamOf(room, playerId);
    if (team && team.playerIds.length < 2) {
      pauseForDropout(room, state, team);
      return undefined;
    }
    if (playerId === state.clueGiverId) {
      const next = teamPlayers(room, team).find((player) => player.id !== playerId);
      state.clueGiverId = next?.id || null;
      if (!state.clueGiverId) {
        pauseForDropout(room, state, team);
        return undefined;
      }
    }
    return undefined;
  },

  onPlayerJoin(room, playerId) {
    const state = room.state;
    if (!state || state.done || state.phase !== "paused") return;
    const team = (room.teams || []).find((item) => item.playerIds.includes(playerId));
    if (team) state.playerTeams[playerId] = team.id;
    if (room.players.get(playerId)?.connected) resumeFromPause(room, state);
  },

  canJoinDuringPause(room) {
    return room.state?.phase === "paused";
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const team = (room.teams || []).find((item) => item.id === state.currentTeamId);
    const isClueGiver = viewerId === state.clueGiverId;
    const isCurrentTeam = Boolean(team?.playerIds.includes(viewerId));
    const base = {
      phase: state.phase,
      round: Object.values(state.turnsByTeam).reduce((total, value) => total + value, 0) + 1,
      rounds: 10,
      mode: room.mode,
      currentTeamId: state.currentTeamId,
      currentTeamName: team?.name || "Team",
      isCurrentTeam,
      isClueGiver,
      word: isClueGiver || state.phase === "result" ? state.word?.text || null : null,
      clues: [...state.clues],
      turnMs: configFor(MODES, room.mode).turnMs,
      myGuess: state.guesses[viewerId] || null,
      paused: state.phase === "paused",
      pauseEndsAt: state.phase === "paused" ? state.endsAt : null,
      pauseReason: state.pauseReason || null,
      pauseTeamName:
        (room.teams || []).find((item) => item.id === state.pauseTeamId)?.name || null,
      endsAt: state.endsAt,
      ...teamsView(room),
    };
    if (state.phase === "result") return { ...base, result: state.result };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      currentTeamName: (room.teams || []).find((team) => team.id === state.currentTeamId)?.name || "Team",
      clues: [...state.clues],
      paused: state.phase === "paused",
      pauseEndsAt: state.phase === "paused" ? state.endsAt : null,
      pauseReason: state.pauseReason || null,
      ...teamsView(room),
    };
    return state.phase === "result" ? { ...base, result: state.result } : base;
  },
};

export default password;
