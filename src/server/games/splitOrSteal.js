import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: { label: "Classic", description: "Three rounds of secret split-or-steal choices", rounds: 3, chooseMs: 20_000, revealMs: 8_000 },
  sudden: { label: "Sudden Death", description: "One round. Choose carefully.", rounds: 1, chooseMs: 12_000, revealMs: 8_000 },
};

function buildPairs(room, state) {
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  state.byeId = null;
  let pool = active;
  if (active.length % 2 === 1) {
    state.byeId = active[(state.round - 1) % active.length].id;
    pool = active.filter((player) => player.id !== state.byeId);
  }
  state.pairs = [];
  for (let index = 0; index < pool.length; index += 2) {
    state.pairs.push({ id: `pair-${state.round}-${index / 2}`, playerIds: [pool[index].id, pool[index + 1].id], choices: {}, result: null });
  }
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  if (state.round >= state.rounds) {
    state.done = true;
    return "results";
  }
  state.round += 1;
  buildPairs(room, state);
  state.phase = "choose";
  state.reveal = null;
  state.endsAt = Date.now() + config.chooseMs;
  return undefined;
}

function pairName(room, playerId) {
  return room.players.get(playerId)?.name || "Player";
}

function resolveChoices(room, state) {
  const rows = [];
  for (const pair of state.pairs) {
    const [a, b] = pair.playerIds;
    const choiceA = pair.choices[a] || "split";
    const choiceB = pair.choices[b] || "split";
    let pointsA = 0;
    let pointsB = 0;
    if (choiceA === "split" && choiceB === "split") { pointsA = 3; pointsB = 3; }
    else if (choiceA === "steal" && choiceB === "steal") { pointsA = 0; pointsB = 0; }
    else if (choiceA === "steal") { pointsA = 6; pointsB = 0; }
    else { pointsA = 0; pointsB = 6; }
    room.scores[a] = Number(room.scores[a] || 0) + pointsA;
    room.scores[b] = Number(room.scores[b] || 0) + pointsB;
    pair.result = { choiceA, choiceB, pointsA, pointsB };
    rows.push({
      pairId: pair.id,
      players: [
        { playerId: a, name: pairName(room, a), choice: choiceA, points: pointsA },
        { playerId: b, name: pairName(room, b), choice: choiceB, points: pointsB },
      ],
    });
  }
  state.reveal = {
    pairs: rows,
    byeId: state.byeId, byeName: state.byeId ? pairName(room, state.byeId) : null,
    roundPoints: rows.flatMap((row) => row.players.filter((player) => player.points > 0)),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
}

const splitOrSteal = {
  id: "split-or-steal",
  name: "Split or Steal", description: "Secretly split the pot with a partner, or take it all.",
  emoji: "🤝", accent: "coral", tag: "Social",
  minPlayers: 2, maxPlayers: 12, modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    room.state = {
      phase: "choose", round: 0, rounds: configFor(MODES, room.mode).rounds,
      pairs: [], byeId: null, reveal: null, done: false, endsAt: null,
    };
    beginRound(room, room.state);
    return room.state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase !== "choose" || event.type !== "choose") return;
    const choice = event.value;
    if (!["split", "steal"].includes(choice)) throw failure("invalid_choice", "Choose split or steal");
    const pair = state.pairs.find((item) => item.playerIds.includes(playerId));
    if (!pair) throw failure("no_pair", "You are sitting out this round");
    if (pair.choices[playerId] !== undefined) throw failure("already_chosen", "You already chose");
    pair.choices[playerId] = choice;
    if (state.pairs.every((item) => item.playerIds.every((id) => item.choices[id] !== undefined))) {
      resolveChoices(room, state);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "choose") {
      resolveChoices(room, state);
      return;
    }
    if (state.phase === "reveal") return beginRound(room, state);
    return undefined;
  },

  onPlayerLeave(room) {
    const state = room.state;
    if (!state || state.done) return;
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (state.phase === "choose") buildPairs(room, state);
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const pair = state.pairs.find((item) => item.playerIds.includes(viewerId));
    const partnerId = pair?.playerIds.find((id) => id !== viewerId);
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds, mode: room.mode,
      partnerId: partnerId || null,
      partnerName: partnerId ? pairName(room, partnerId) : null,
      isBye: state.byeId === viewerId,
      hasChosen: Boolean(pair?.choices[viewerId]),
      myChoice: pair?.choices[viewerId] || null,
      submitted: state.pairs.filter((item) => item.playerIds.every((id) => item.choices[id] !== undefined)).length,
      total: state.pairs.length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase, round: state.round, rounds: state.rounds,
      submitted: state.pairs.filter((item) => item.playerIds.every((id) => item.choices[id] !== undefined)).length,
      total: state.pairs.length,
    };
    return state.phase === "reveal" ? { ...base, reveal: state.reveal } : base;
  },
};

export default splitOrSteal;
