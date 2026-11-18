import { createRequire } from "node:module";
import { activePlayers, addPoints, choosePrompt, commitPoints, configFor, failure, pointsList } from "./shared.js";

const require = createRequire(import.meta.url);
const LOCATIONS = require("../data/prompts/modesContent.json").spyfall;

const MODES = {
  classic: { label: "Classic", description: "Question, accuse, survive: three locations", rounds: 3, questionMs: 180_000, voteMs: 45_000, revealMs: 10_000 },
  blitz: { label: "Blitz", description: "Shorter rounds and faster accusations", rounds: 4, questionMs: 120_000, voteMs: 30_000, revealMs: 8_000 },
};

function shuffled(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  state.round += 1;
  state.location = choosePrompt(LOCATIONS, state);
  state.spyId = active[Math.floor(Math.random() * active.length)].id;
  const roles = shuffled(state.location.roles);
  state.roles = {};
  let roleIndex = 0;
  for (const player of active) {
    if (player.id === state.spyId) state.roles[player.id] = "Spy";
    else {
      state.roles[player.id] = roles[roleIndex % roles.length];
      roleIndex += 1;
    }
  }
  state.phase = "question";
  state.votes = {};
  state.guess = null;
  state.reveal = null;
  state.endsAt = Date.now() + config.questionMs;
  return undefined;
}

function resolveVotes(room, state) {
  const counts = new Map();
  for (const targetId of Object.values(state.votes)) counts.set(targetId, (counts.get(targetId) || 0) + 1);
  const highest = Math.max(0, ...counts.values());
  const accused = [...counts.entries()].filter(([, count]) => count === highest).map(([id]) => id);
  const caught = accused.length === 1 && accused[0] === state.spyId;
  if (caught) {
    state.phase = "spyGuess";
    state.endsAt = Date.now() + 30_000;
    state.reveal = { caught, location: state.location.location, spyId: state.spyId };
    return;
  }
  finishRound(room, state, false, null);
}

function finishRound(room, state, caught, guess) {
  const points = new Map();
  const correctGuess =
    caught && typeof guess === "string" &&
    guess.toLowerCase().trim() === state.location.location.toLowerCase();
  if (!caught) {
    addPoints(room, points, state.spyId, 200);
  } else if (correctGuess) {
    addPoints(room, points, state.spyId, 200);
    for (const voter of Object.keys(state.votes)) {
      if (state.votes[voter] === state.spyId) addPoints(room, points, voter, 50);
    }
  } else {
    for (const player of activePlayers(room)) {
      if (player.id !== state.spyId) addPoints(room, points, player.id, 100);
    }
  }
  commitPoints(room, points);
  state.reveal = {
    location: state.location.location,
    spyId: state.spyId,
    spyName: room.players.get(state.spyId)?.name || "Player",
    caught, guess: guess || null, correctGuess,
    votes: Object.entries(state.votes).map(([playerId, targetId]) => ({
      playerId, name: room.players.get(playerId)?.name || "Player",
      targetId, targetName: room.players.get(targetId)?.name || "Player",
    })),
    roundPoints: pointsList(room, points),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const spyfall = {
  id: "spyfall",
  name: "Spyfall",
  description: "Everyone shares a location and role except the spy. Ask questions and unmask them.",
  emoji: "🕵️", accent: "grape", tag: "Social",
  minPlayers: 4, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "question", round: 0, rounds: configFor(MODES, room.mode).rounds,
      location: null, spyId: null, roles: {}, votes: {}, guess: null,
      reveal: null, usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "question" && event.type === "callVote") {
      state.phase = "vote";
      state.votes = {};
      state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
      return;
    }
    if (state.phase === "vote" && event.type === "vote") {
      if (state.votes[playerId] !== undefined) throw failure("already_voted", "You already voted");
      if (event.targetId === playerId || !room.players.has(event.targetId)) {
        throw failure("invalid_target", "Vote for another player");
      }
      state.votes[playerId] = event.targetId;
      if (activePlayers(room).every((player) => state.votes[player.id] !== undefined)) resolveVotes(room, state);
      return;
    }
    if (state.phase === "spyGuess" && event.type === "guess") {
      if (playerId !== state.spyId) throw failure("not_spy", "Only the spy can guess the location");
      if (state.guess !== null) throw failure("already_guessed", "You already guessed");
      state.guess = String(event.value ?? "").trim().slice(0, 60);
      if (!state.guess) throw failure("guess_required", "Guess a location");
      finishRound(room, state, true, state.guess);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "question") {
      state.phase = "vote";
      state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
      return;
    }
    if (state.phase === "vote") {
      resolveVotes(room, state);
      return;
    }
    if (state.phase === "spyGuess") {
      finishRound(room, state, true, state.guess || "no guess");
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    if (playerId === state.spyId || activePlayers(room).length < 4) {
      state.done = true;
      return "results";
    }
    delete state.votes[playerId];
    if (state.phase === "vote" && activePlayers(room).every((player) => state.votes[player.id] !== undefined)) {
      resolveVotes(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isSpy = viewerId === state.spyId;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      youId: viewerId, isSpy, role: state.roles[viewerId] || "Player",
      location: isSpy && state.phase !== "reveal" ? null : state.location?.location,
      roleList: state.phase === "reveal" ? state.location?.roles || [] : undefined,
      locations: state.phase === "reveal" ? undefined : LOCATIONS.map((item) => item.location),
      submitted: Object.keys(state.votes).length, total: activePlayers(room).length,
      hasVoted: state.votes[viewerId] !== undefined, guess: state.guess,
      players: activePlayers(room).map((player) => ({ playerId: player.id, name: player.name })),
    };
    if (state.phase === "reveal") return { ...base, reveal: state.reveal, location: state.location.location };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      submitted: Object.keys(state.votes).length, total: activePlayers(room).length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default spyfall;
