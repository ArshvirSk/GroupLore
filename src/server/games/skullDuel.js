import { activePlayers, configFor, failure } from "./shared.js";

const MODES = {
  classic: {
    label: "Classic",
    description: "First to two successful challenges wins",
    targetWins: 2,
    placeMs: 20_000,
    bidMs: 20_000,
    revealMs: 8_000,
  },
  quick: {
    label: "Quick",
    description: "One successful challenge takes the duel",
    targetWins: 1,
    placeMs: 15_000,
    bidMs: 15_000,
    revealMs: 6_000,
  },
};

function activeIds(room) {
  return activePlayers(room)
    .map((player) => player.id)
    .sort(
      (a, b) =>
        Number(room.players.get(a)?.joinedAt || 0) -
        Number(room.players.get(b)?.joinedAt || 0),
    );
}

function makeTokens(room, playerId) {
  return [
    { id: `${playerId}-safe-1`, playerId, kind: "safe" },
    { id: `${playerId}-safe-2`, playerId, kind: "safe" },
    { id: `${playerId}-safe-3`, playerId, kind: "safe" },
    { id: `${playerId}-hazard`, playerId, kind: "hazard" },
  ];
}

function availableTokens(state, playerId) {
  const lost = new Set(state.lost[playerId] || []);
  return (state.tokens[playerId] || []).filter((token) => !lost.has(token.id));
}

function allPlaced(room, state) {
  return activeIds(room).every((playerId) => {
    if (!availableTokens(state, playerId).length) return true;
    return Boolean(state.placed[playerId]);
  });
}

function allBid(room, state) {
  return activeIds(room)
    .filter((playerId) => availableTokens(state, playerId).length > 0)
    .every((playerId) => state.bids[playerId] !== undefined);
}

function finishGame(room, state) {
  const order = [...activeIds(room)].sort((a, b) => {
    const wins = Number(state.wins[b] || 0) - Number(state.wins[a] || 0);
    if (wins) return wins;
    return availableTokens(state, b).length - availableTokens(state, a).length;
  });
  order.forEach((playerId, index) => {
    room.scores[playerId] =
      Number(state.wins[playerId] || 0) * 1000 +
      Math.max(0, 500 - index * 50);
  });
  state.done = true;
  return "results";
}

function beginPlacement(room, state) {
  state.phase = "place";
  state.placed = {};
  state.bids = {};
  state.reveal = null;
  state.endsAt = Date.now() + configFor(MODES, room.mode).placeMs;
  if (activeIds(room).every((id) => !availableTokens(state, id).length)) {
    return finishGame(room, state);
  }
  return undefined;
}

function resolveChallenge(room, state) {
  const bidder = activeIds(room)
    .filter((playerId) => state.bids[playerId] !== undefined)
    .sort((a, b) => {
      const bid = Number(state.bids[b]) - Number(state.bids[a]);
      if (bid) return bid;
      return activeIds(room).indexOf(a) - activeIds(room).indexOf(b);
    })[0];
  if (!bidder) return beginPlacement(room, state);
  const bid = Number(state.bids[bidder]);

  const ownToken = state.placed[bidder];
  const others = activeIds(room)
    .filter((playerId) => playerId !== bidder && state.placed[playerId])
    .map((playerId) => state.placed[playerId]);
  const candidates = [
    ...(ownToken ? [ownToken] : []),
    ...others,
  ].slice(0, bid);

  const found = [];
  let hitHazard = false;
  for (const tokenId of candidates) {
    const token = Object.values(state.tokens)
      .flat()
      .find((entry) => entry.id === tokenId);
    if (!token) continue;
    found.push({ ...token, faceUp: true });
    if (token.kind === "hazard") {
      hitHazard = true;
      break;
    }
  }

  const hazardToken = hitHazard
    ? found.find((token) => token.kind === "hazard")
    : null;
  if (hazardToken) {
    state.lost[hazardToken.playerId] = [
      ...new Set([...(state.lost[hazardToken.playerId] || []), hazardToken.id]),
    ];
  }
  if (hitHazard) {
    const penalty = availableTokens(state, bidder).find(
      (token) => token.kind === "safe",
    );
    if (penalty) {
      state.lost[bidder] = [...new Set([...(state.lost[bidder] || []), penalty.id])];
    }
  } else {
    state.wins[bidder] = Number(state.wins[bidder] || 0) + 1;
  }

  state.reveal = {
    bidderId: bidder,
    bidderName: room.players.get(bidder)?.name || "Player",
    bid,
    tokens: found,
    hitHazard,
    success: !hitHazard,
    wins: Object.fromEntries(
      activeIds(room).map((id) => [id, Number(state.wins[id] || 0)]),
    ),
    targetWins: configFor(MODES, room.mode).targetWins,
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + configFor(MODES, room.mode).revealMs;
  return undefined;
}

const skullDuel = {
  id: "skull-duel",
  name: "Skull Duel",
  description: "Hide your hazard, raise the bid, and flip without a sting.",
  emoji: "💀",
  accent: "plum",
  tag: "Strategy",
  minPlayers: 3,
  maxPlayers: 6,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const ids = activeIds(room);
    const state = {
      phase: "place",
      round: 1,
      tokens: Object.fromEntries(ids.map((id) => [id, makeTokens(room, id)])),
      lost: Object.fromEntries(ids.map((id) => [id, []])),
      placed: {},
      bids: {},
      wins: Object.fromEntries(ids.map((id) => [id, 0])),
      reveal: null,
      done: false,
      endsAt: Date.now() + configFor(MODES, room.mode).placeMs,
    };
    room.state = state;
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "place" && event.type === "place") {
      if (state.placed[playerId]) {
        throw failure("already_placed", "You already placed a token");
      }
      const token = availableTokens(state, playerId).find(
        (entry) => entry.id === event.tokenId,
      );
      if (!token) throw failure("invalid_token", "Choose one of your tokens");
      state.placed[playerId] = token.id;
      if (allPlaced(room, state)) {
        state.phase = "bid";
        state.endsAt = Date.now() + configFor(MODES, room.mode).bidMs;
      }
      return undefined;
    }
    if (state.phase === "bid" && event.type === "bid") {
      if (state.bids[playerId] !== undefined) {
        throw failure("already_bid", "You already bid");
      }
      const placedCount = Object.keys(state.placed).length;
      const value = Number(event.value);
      if (!Number.isInteger(value) || value < 1 || value > placedCount) {
        throw failure("invalid_bid", `Bid between 1 and ${placedCount}`);
      }
      state.bids[playerId] = value;
      if (allBid(room, state)) resolveChallenge(room, state);
      return undefined;
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "place") {
      for (const playerId of activeIds(room)) {
        if (state.placed[playerId]) continue;
        const token = availableTokens(state, playerId)[0];
        if (token) state.placed[playerId] = token.id;
      }
      state.phase = "bid";
      state.endsAt = Date.now() + configFor(MODES, room.mode).bidMs;
      return;
    }
    if (state.phase === "bid") {
      for (const playerId of activeIds(room)) {
        if (state.bids[playerId] === undefined && state.placed[playerId]) {
          state.bids[playerId] = 1;
        }
      }
      resolveChallenge(room, state);
      return;
    }
    if (state.phase === "reveal") {
      const target = configFor(MODES, room.mode).targetWins;
      if (activeIds(room).some((id) => Number(state.wins[id] || 0) >= target)) {
        return finishGame(room, state);
      }
      state.round += 1;
      return beginPlacement(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.tokens[playerId];
    delete state.lost[playerId];
    delete state.placed[playerId];
    delete state.bids[playerId];
    delete state.wins[playerId];
    if (activeIds(room).length < 3) {
      return finishGame(room, state);
    }
    if (state.phase === "place" && allPlaced(room, state)) {
      state.phase = "bid";
      state.endsAt = Date.now() + configFor(MODES, room.mode).bidMs;
    }
    if (state.phase === "bid" && allBid(room, state)) {
      resolveChallenge(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const ids = activeIds(room);
    const base = {
      phase: state.phase,
      round: state.round,
      mode: room.mode,
      targetWins: configFor(MODES, room.mode).targetWins,
      wins: Object.fromEntries(ids.map((id) => [id, Number(state.wins[id] || 0)])),
      tokens: state.tokens[viewerId] || [],
      lost: state.lost[viewerId] || [],
      placedTokenId: state.placed[viewerId] || null,
      placedCount: Object.keys(state.placed).length,
      placedPlayers: Object.keys(state.placed),
      submitted: Object.keys(state.placed).length,
      total: ids.length,
      yourBid: state.bids[viewerId] ?? null,
      bidsSubmitted: Object.keys(state.bids).length,
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
    return base;
  },

  publicFor(room) {
    const state = room.state;
    const ids = activeIds(room);
    return {
      phase: state.phase,
      round: state.round,
      targetWins: configFor(MODES, room.mode).targetWins,
      wins: Object.fromEntries(ids.map((id) => [id, Number(state.wins[id] || 0)])),
      placedCount: Object.keys(state.placed).length,
      placedPlayers: Object.keys(state.placed),
      bidsSubmitted: Object.keys(state.bids).length,
      total: ids.length,
      reveal: state.phase === "reveal" ? state.reveal : null,
    };
  },
};

export default skullDuel;
