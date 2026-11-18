import { createRequire } from "node:module";
import { activePlayers, addPoints, choosePrompt, commitPoints, configFor, failure, pointsList } from "./shared.js";
import { normalizeText } from "../engine/primitives/normalize.js";

const require = createRequire(import.meta.url);
const CARDS = require("../data/prompts/modesContent.json").chameleon;

const MODES = {
  classic: { label: "Classic", description: "Three rounds of clues and one hidden chameleon", rounds: 3, clueMs: 35_000, voteMs: 25_000, revealMs: 9_000 },
  quick: { label: "Quick", description: "Two fast rounds", rounds: 2, clueMs: 22_000, voteMs: 18_000, revealMs: 7_000 },
};

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  state.round += 1;
  state.card = choosePrompt(CARDS, state);
  state.chameleonId = active[(state.round - 1) % active.length].id;
  state.phase = "clue";
  state.clues = {};
  state.votes = {};
  state.reveal = null;
  state.endsAt = Date.now() + config.clueMs;
  return undefined;
}

function resolveVotes(room, state) {
  const counts = new Map();
  for (const targetId of Object.values(state.votes)) {
    counts.set(targetId, (counts.get(targetId) || 0) + 1);
  }
  const highest = Math.max(0, ...counts.values());
  const accused = [...counts.entries()].filter(([, count]) => count === highest).map(([id]) => id);
  const caught = accused.length === 1 && accused[0] === state.chameleonId;
  const points = new Map();
  if (caught) {
    for (const [voterId, targetId] of Object.entries(state.votes)) {
      if (targetId === state.chameleonId) addPoints(room, points, voterId, 150);
    }
    addPoints(room, points, state.chameleonId, 0);
  } else {
    addPoints(room, points, state.chameleonId, 300);
  }
  commitPoints(room, points);
  state.reveal = {
    secret: state.card.secret,
    chameleonId: state.chameleonId,
    chameleonName: room.players.get(state.chameleonId)?.name || "Player",
    caught,
    votes: Object.entries(state.votes).map(([playerId, targetId]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      targetId,
      targetName: room.players.get(targetId)?.name || "Player",
    })),
    roundPoints: pointsList(room, points),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const chameleon = {
  id: "chameleon",
  name: "Chameleon",
  description: "Everyone knows the secret word except one player. Blend in, then find the fake.",
  emoji: "🦎",
  accent: "teal",
  tag: "Social",
  minPlayers: 4,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "clue", round: 0, rounds: configFor(MODES, room.mode).rounds,
      card: null, chameleonId: null, clues: {}, votes: {}, reveal: null,
      usedPromptIds: [], done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "clue" && event.type === "clue") {
      if (state.clues[playerId] !== undefined) throw failure("already_clued", "You already gave a clue");
      const clue = String(event.value ?? "").trim().slice(0, 40);
      if (!clue) throw failure("clue_required", "Give a one-word clue");
      if (normalizeText(clue) === normalizeText(state.card.secret)) {
        throw failure("secret_spoken", "Do not say the secret word");
      }
      state.clues[playerId] = clue;
      if (activePlayers(room).every((player) => state.clues[player.id] !== undefined)) {
        state.phase = "vote";
        state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
      }
      return;
    }
    if (state.phase === "vote" && event.type === "vote") {
      if (playerId === state.chameleonId) throw failure("chameleon_cannot_vote", "The chameleon does not vote");
      if (state.votes[playerId] !== undefined) throw failure("already_voted", "You already voted");
      if (event.targetId === playerId || !room.players.has(event.targetId)) {
        throw failure("invalid_target", "Vote for another player");
      }
      state.votes[playerId] = event.targetId;
      const voters = activePlayers(room).filter((player) => player.id !== state.chameleonId);
      if (voters.every((player) => state.votes[player.id] !== undefined)) resolveVotes(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "clue") {
      state.phase = "vote";
      state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
      return;
    }
    if (state.phase === "vote") {
      resolveVotes(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    if (playerId === state.chameleonId || activePlayers(room).length < 4) {
      state.done = true;
      return "results";
    }
    delete state.clues[playerId];
    delete state.votes[playerId];
    if (state.phase === "vote" && activePlayers(room).filter((p) => p.id !== state.chameleonId).every((p) => state.votes[p.id] !== undefined)) {
      resolveVotes(room, state);
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const isChameleon = viewerId === state.chameleonId;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      youId: viewerId, topic: state.card?.topic || "", grid: state.card?.words || [],
      isChameleon, chameleonId: state.phase === "reveal" ? state.chameleonId : null,
      clues: Object.entries(state.clues).map(([playerId, clue]) => ({
        playerId, name: room.players.get(playerId)?.name || "Player", clue,
      })),
      players: activePlayers(room).map((player) => ({ playerId: player.id, name: player.name })),
      submitted: Object.keys(state.clues).length, total: activePlayers(room).length,
      hasClued: state.clues[viewerId] !== undefined,
      hasVoted: state.votes[viewerId] !== undefined,
      secret: isChameleon && state.phase !== "reveal" ? null : state.card?.secret,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal, secret: state.card.secret } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      topic: state.card?.topic || "", grid: state.card?.words || [],
      submitted: Object.keys(state.clues).length, total: activePlayers(room).length,
      clues: Object.entries(state.clues).map(([playerId, clue]) => ({
        playerId, name: room.players.get(playerId)?.name || "Player", clue,
      })),
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal, secret: state.card.secret } : base;
  },
};

export default chameleon;
