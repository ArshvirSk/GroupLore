import { activePlayers, configFor, failure } from "./shared.js";
import { shuffle } from "../utils/helpers.js";
import { DUELS, getDuel } from "./duels.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "Single-elimination bracket with a random duel each match",
    matchMs: 120_000,
    advanceMs: 4_000,
  },
  "round-robin": {
    label: "Round Robin",
    description: "Every player faces every other player once",
    matchMs: 120_000,
    advanceMs: 4_000,
  },
};

function pickDuel() {
  return DUELS[Math.floor(Math.random() * DUELS.length)];
}

function roundRobinSchedule(players) {
  const pairs = [];
  for (let first = 0; first < players.length; first += 1) {
    for (let second = first + 1; second < players.length; second += 1) {
      pairs.push({ a: players[first], b: players[second] });
    }
  }
  return shuffle(pairs);
}

function finishRoundRobin(room, state) {
  const best = Math.max(
    0,
    ...state.roundPlayers.map((playerId) => state.matchWins[playerId] || 0),
  );
  const champions = state.roundPlayers.filter(
    (playerId) => (state.matchWins[playerId] || 0) === best,
  );
  state.championIds = champions;
  state.championId = champions[0] || null;
  for (const playerId of champions) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + 500;
  }
  state.done = true;
  state.phase = "results";
  return "results";
}

function beginRoundRobinMatch(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.matchIndex >= state.schedule.length) {
    return finishRoundRobin(room, state);
  }
  const pairing = state.schedule[state.matchIndex];
  if (!state.roundPlayers.includes(pairing.a) || !state.roundPlayers.includes(pairing.b)) {
    state.matchIndex += 1;
    return beginRoundRobinMatch(room, state);
  }
  const duel = pickDuel();
  state.currentMatch = {
    a: pairing.a,
    b: pairing.b,
    duelType: duel.type,
    duelLabel: duel.label,
    duel: duel.init(pairing.a, pairing.b),
  };
  state.phase = "duel";
  state.endsAt = Date.now() + config.matchMs;
  state.lastMatch = null;
  return undefined;
}

function beginMatch(room, state) {
  if (state.format === "round-robin") return beginRoundRobinMatch(room, state);
  const config = configFor(MODES, room.mode);
  while (state.roundPlayers.length > 1 && state.roundPlayers.length % 2 === 1) {
    state.winners.push(state.roundPlayers.pop());
  }
  if (state.roundPlayers.length === 0) {
    state.roundPlayers = state.winners;
    state.winners = [];
    state.round += 1;
    return beginMatch(room, state);
  }
  if (state.matchIndex * 2 + 1 >= state.roundPlayers.length) {
    if (state.winners.length === 1) {
      state.championId = state.winners[0];
      room.scores[state.championId] =
        Number(room.scores[state.championId] || 0) + 500;
      state.done = true;
      return "results";
    }
    state.roundPlayers = state.winners;
    state.winners = [];
    state.matchIndex = 0;
    state.round += 1;
    return beginMatch(room, state);
  }
  const a = state.roundPlayers[state.matchIndex * 2];
  const b = state.roundPlayers[state.matchIndex * 2 + 1];
  const duel = pickDuel();
  state.currentMatch = {
    a,
    b,
    duelType: duel.type,
    duelLabel: duel.label,
    duel: duel.init(a, b),
  };
  state.phase = "duel";
  state.endsAt = Date.now() + config.matchMs;
  state.lastMatch = null;
  return undefined;
}

function finishMatch(room, state, winnerId, reason) {
  const config = configFor(MODES, room.mode);
  const match = state.currentMatch;
  if (!match) return;
  const finalWinner = winnerId || match.a;
  state.winners.push(finalWinner);
  state.matchWins[finalWinner] = (state.matchWins[finalWinner] || 0) + 1;
  room.scores[finalWinner] = Number(room.scores[finalWinner] || 0) + 100;
  state.lastMatch = {
    a: match.a,
    b: match.b,
    aName: room.players.get(match.a)?.name || "Player",
    bName: room.players.get(match.b)?.name || "Player",
    duelType: match.duelType,
    duelLabel: match.duelLabel,
    winnerId: finalWinner,
    winnerName: room.players.get(finalWinner)?.name || "Player",
    reason,
  };
  state.matchIndex += 1;
  state.phase = "advance";
  state.endsAt = Date.now() + config.advanceMs;
}

const duelBracket = {
  id: "duel-bracket",
  name: "Duel Bracket",
  description: "Tiny duels, a live bracket, and one survivor.",
  emoji: "🥊",
  accent: "coral",
  tag: "Strategy",
  minPlayers: 4,
  maxPlayers: 8,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const players = activePlayers(room).map((player) => player.id);
    const format = room.mode === "round-robin" ? "round-robin" : "classic";
    const state = {
      phase: "duel",
      format,
      schedule: format === "round-robin" ? roundRobinSchedule(shuffle(players)) : [],
      round: 1,
      roundPlayers: shuffle(players),
      winners: [],
      matchIndex: 0,
      currentMatch: null,
      lastMatch: null,
      matchWins: {},
      championId: null,
      championIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginMatch(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "duel" || event.type !== "move") return;
    const match = state.currentMatch;
    if (!match || (playerId !== match.a && playerId !== match.b)) {
      throw failure("spectator", "You are watching this duel");
    }
    const duel = getDuel(match.duelType);
    try {
      duel.move(match.duel, playerId, event.move || {});
    } catch (error) {
      throw failure("invalid_move", error.message || "That move is not allowed");
    }
    const status = duel.status(match.duel);
    if (status.done) finishMatch(room, state, status.winnerId || playerId);
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "duel") {
      const match = state.currentMatch;
      if (!match) return "results";
      const duel = getDuel(match.duelType);
      const status = duel.status(match.duel);
      let winner = status.winnerId;
      if (!winner) {
        const aScore = duel.score(match.duel, match.a);
        const bScore = duel.score(match.duel, match.b);
        winner = aScore === bScore ? match.a : aScore > bScore ? match.a : match.b;
      }
      finishMatch(room, state, winner, "timer");
      return;
    }
    if (state.phase === "advance") {
      return beginMatch(room, state);
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
    const match = state.currentMatch;
    if (match && (match.a === playerId || match.b === playerId)) {
      finishMatch(room, state, match.a === playerId ? match.b : match.a, "forfeit");
      return;
    }
    if (state.format === "round-robin") {
      state.roundPlayers = state.roundPlayers.filter((id) => id !== playerId);
      return undefined;
    }
    state.roundPlayers = state.roundPlayers.filter((id) => id !== playerId);
    state.winners = state.winners.filter((id) => id !== playerId);
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const match = state.currentMatch;
    const duel = match ? getDuel(match.duelType) : null;
    const isPlayer = Boolean(match && (viewerId === match.a || viewerId === match.b));
    return {
      phase: state.phase,
      round: state.round,
      rounds: null,
      format: state.format,
      bracket: {
        remaining: [...state.roundPlayers],
        winners: [...state.winners],
        matchIndex: state.matchIndex,
        scheduleLength: state.schedule.length,
        matchesPlayed: state.format === "round-robin" ? state.matchIndex : undefined,
        standings: state.roundPlayers.map((playerId) => ({
          playerId,
          name: room.players.get(playerId)?.name || "Player",
          wins: state.matchWins[playerId] || 0,
        })),
      },
      match: match
        ? {
            a: match.a,
            b: match.b,
            aName: room.players.get(match.a)?.name || "Player",
            bName: room.players.get(match.b)?.name || "Player",
            duelType: match.duelType,
            duelLabel: match.duelLabel,
          }
        : null,
      isPlayer,
      duel: match && duel ? duel.viewFor(match.duel, isPlayer ? viewerId : null) : null,
      lastMatch: state.lastMatch,
      championId: state.championId,
      championIds: [...state.championIds],
    };
  },

  publicFor(room) {
    const state = room.state;
    const match = state.currentMatch;
    const duel = match ? getDuel(match.duelType) : null;
    return {
      phase: state.phase,
      round: state.round,
      format: state.format,
      scheduleLength: state.schedule.length,
      matchesPlayed: state.format === "round-robin" ? state.matchIndex : undefined,
      match: match
        ? {
            aName: room.players.get(match.a)?.name || "Player",
            bName: room.players.get(match.b)?.name || "Player",
            duelLabel: match.duelLabel,
          }
        : null,
      duel: match && duel ? duel.viewFor(match.duel, null) : null,
      lastMatch: state.lastMatch,
      championIds: [...state.championIds],
    };
  },
};

export default duelBracket;
