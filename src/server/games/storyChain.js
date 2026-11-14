import { createRequire } from "node:module";
import { activePlayers, configFor, failure } from "./shared.js";
import { advanceChain } from "../engine/primitives/chain.js";

const require = createRequire(import.meta.url);
const STARTERS = require("../data/prompts/storyChain.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Every chain visits every player, one sentence at a time",
    turnMs: 40_000,
    voteMs: 35_000,
    maxPasses: null,
  },
  short: {
    label: "Short",
    description: "At most four passes, then straight to the vote",
    turnMs: 30_000,
    voteMs: 25_000,
    maxPasses: 4,
  },
};

function nextStarter(state) {
  if (state.usedStarterIds.length >= STARTERS.length) state.usedStarterIds = [];
  let index = Math.floor(Math.random() * STARTERS.length);
  let guard = 0;
  while (state.usedStarterIds.includes(STARTERS[index].id) && guard < 400) {
    index = Math.floor(Math.random() * STARTERS.length);
    guard += 1;
  }
  state.usedStarterIds.push(STARTERS[index].id);
  return STARTERS[index];
}

function currentChainFor(state, playerId) {
  return state.chains.find((chain) => chain.currentPlayerId === playerId) || null;
}

function beginPass(room, state) {
  state.phase = "pass";
  state.passRound += 1;
  state.submitted = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).turnMs;
}

function beginVote(room, state) {
  state.phase = "vote";
  state.votes = {};
  state.endsAt = Date.now() + configFor(MODES, room.mode).voteMs;
}

function resolveVote(room, state) {
  const storyCounts = new Map();
  const lineCounts = new Map();
  for (const vote of Object.values(state.votes)) {
    if (vote.chainId) {
      storyCounts.set(vote.chainId, (storyCounts.get(vote.chainId) || 0) + 1);
    }
    if (vote.lineId) {
      lineCounts.set(vote.lineId, (lineCounts.get(vote.lineId) || 0) + 1);
    }
  }
  const bestStoryCount = Math.max(0, ...storyCounts.values());
  const bestLineCount = Math.max(0, ...lineCounts.values());
  const winningChains = state.chains.filter(
    (chain) => (storyCounts.get(chain.id) || 0) === bestStoryCount && bestStoryCount > 0,
  );
  const winningLines = new Map();
  for (const chain of state.chains) {
    for (const [index, entry] of chain.entries.entries()) {
      const lineId = `${chain.id}:${index}`;
      if ((lineCounts.get(lineId) || 0) === bestLineCount && bestLineCount > 0) {
        winningLines.set(lineId, entry.playerId);
      }
    }
  }
  const points = new Map();
  const add = (playerId, amount) => {
    if (!room.players.has(playerId) || !amount) return;
    points.set(playerId, (points.get(playerId) || 0) + amount);
  };
  for (const chain of winningChains) {
    for (const entry of chain.entries) add(entry.playerId, 300);
  }
  for (const playerId of winningLines.values()) add(playerId, 200);
  for (const [playerId, amount] of points) {
    room.scores[playerId] = Number(room.scores[playerId] || 0) + amount;
  }
  state.result = {
    bestStoryIds: winningChains.map((chain) => chain.id),
    bestLineIds: [...winningLines.keys()],
    roundPoints: [...points.entries()].map(([playerId, amount]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      points: amount,
    })),
    chains: state.chains.map((chain) => ({
      id: chain.id,
      starter: chain.starter,
      entries: chain.entries.map((entry) => ({
        playerId: entry.playerId,
        name: room.players.get(entry.playerId)?.name || "Player",
        text: entry.text,
      })),
    })),
  };
  state.done = true;
  return "results";
}

const storyChain = {
  id: "story-chain",
  name: "Story Chain",
  description: "Build one absurd story together, one sentence at a time.",
  emoji: "📖",
  accent: "lavender",
  tag: "Write",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const players = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
    const usedStarters = [];
    const state = {
      phase: "start",
      chains: players.map((player, index) => {
        let starter = nextStarter({ usedStarterIds: usedStarters });
        while (usedStarters.filter((id) => id === starter.id).length > 1) {
          starter = nextStarter({ usedStarterIds: usedStarters });
        }
        return {
          id: `story-${index + 1}`,
          starter,
          entries: [],
          ownerId: player.id,
          currentPlayerId: player.id,
          complete: false,
        };
      }),
      passRound: 0,
      votes: {},
      submitted: {},
      result: null,
      usedStarterIds: usedStarters,
      done: false,
      endsAt: Date.now() + configFor(MODES, room.mode).turnMs,
    };
    room.state = state;
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "start" && event.type === "start") {
      const chain = state.chains.find((item) => item.ownerId === playerId);
      if (!chain) throw failure("chain_missing", "You have no chain");
      if (chain.entries.length) throw failure("already_started", "You already started");
      const text = String(event.value ?? "").trim().slice(0, 140);
      if (!text) throw failure("sentence_required", "Write a sentence first");
      chain.entries.push({ playerId, text, at: Date.now() });
      chain.currentPlayerId = nextPlayer(room, playerId);
      if (activePlayers(room).every((player) =>
        state.chains.find((item) => item.ownerId === player.id)?.entries.length,
      )) {
        beginPass(room, state);
      }
      return;
    }
    if (state.phase === "pass" && event.type === "sentence") {
      const chain = currentChainFor(state, playerId);
      if (!chain) throw failure("not_your_turn", "No chain is waiting for you");
      if (state.submitted[playerId]) throw failure("already_submitted", "Sentence already sent");
      const text = String(event.value ?? "").trim().slice(0, 140);
      state.submitted[playerId] = true;
      advanceChain(chain, activePlayers(room).map((player) => player.id), text || "…", playerId);
      if (activePlayers(room).every((player) => state.submitted[player.id])) {
        const maxPasses = configFor(MODES, room.mode).maxPasses;
        if (
          state.chains.every((item) => item.complete) ||
          (maxPasses && state.passRound >= maxPasses)
        ) {
          beginVote(room, state);
          return;
        }
        beginPass(room, state);
      }
      return;
    }
    if (state.phase === "vote" && event.type === "vote") {
      if (state.votes[playerId]) throw failure("already_voted", "You already voted");
      const chainId = String(event.chainId || "");
      const lineId = String(event.lineId || "");
      if (!state.chains.some((chain) => chain.id === chainId)) {
        throw failure("invalid_story", "Pick a story");
      }
      const entryIndex = Number(lineId.split(":")[1]);
      const chain = state.chains.find((item) => item.id === chainId);
      if (lineId && (!Number.isInteger(entryIndex) || !chain.entries[entryIndex])) {
        throw failure("invalid_line", "Pick a line from that story");
      }
      if (chain.entries[entryIndex]?.playerId === playerId) {
        throw failure("cannot_vote_own_line", "Pick a line by someone else");
      }
      state.votes[playerId] = { chainId, lineId: lineId || null };
      if (activePlayers(room).every((player) => state.votes[player.id])) {
        return resolveVote(room, state);
      }
      return;
    }
    return undefined;
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "start" || state.phase === "pass") {
      if (state.phase === "start") {
        const active = activePlayers(room);
        for (const player of active) {
          const chain = state.chains.find((item) => item.ownerId === player.id);
          if (chain && !chain.entries.length) {
            chain.entries.push({ playerId: player.id, text: "…", at: Date.now() });
            chain.currentPlayerId = nextPlayer(room, player.id);
          }
        }
        beginPass(room, state);
        return;
      }
      for (const chain of state.chains) {
        if (chain.currentPlayerId && !chain.complete) {
          advanceChain(
            chain,
            activePlayers(room).map((player) => player.id),
            "…",
            chain.currentPlayerId,
          );
        }
      }
      state.submitted = {};
      if (state.chains.every((chain) => chain.complete)) {
        beginVote(room, state);
      } else {
        beginPass(room, state);
      }
      return;
    }
    if (state.phase === "vote") return resolveVote(room, state);
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    state.chains = state.chains.filter((chain) => chain.ownerId !== playerId);
    delete state.submitted[playerId];
    delete state.votes[playerId];
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    for (const chain of state.chains) {
      if (chain.currentPlayerId === playerId) {
        chain.currentPlayerId = nextPlayer(room, playerId);
      }
    }
    if (state.phase === "pass" && activePlayers(room).every((player) => state.submitted[player.id])) {
      if (state.chains.every((chain) => chain.complete)) beginVote(room, state);
      else beginPass(room, state);
    }
    if (state.phase === "vote" && activePlayers(room).every((player) => state.votes[player.id])) {
      return resolveVote(room, state);
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const mine =
      state.phase === "start"
        ? state.chains.find((chain) => chain.ownerId === viewerId)
        : currentChainFor(state, viewerId);
    const base = {
      phase: state.phase,
      round: state.passRound + 1,
      rounds: null,
      starter: mine?.starter?.text || null,
      lastSentence: mine?.entries?.at(-1)?.text || null,
      lastAuthor: mine?.entries?.at(-1)
        ? room.players.get(mine.entries.at(-1).playerId)?.name || "Player"
        : null,
      chainCount: state.chains.filter((chain) => chain.complete).length,
      totalChains: state.chains.length,
      mySubmitted: Boolean(state.submitted[viewerId]),
      myVote: state.votes[viewerId] || null,
    };
    if (state.phase === "vote") {
      return {
        ...base,
        stories: state.chains.map((chain) => ({
          id: chain.id,
          starter: chain.starter.text,
          lines: chain.entries.map((entry, index) => ({
            id: `${chain.id}:${index}`,
            text: entry.text,
            author: room.players.get(entry.playerId)?.name || "Player",
            isMine: entry.playerId === viewerId,
          })),
        })),
      };
    }
    return base;
  },

  publicFor(room) {
    const state = room.state;
    return {
      phase: state.phase,
      round: state.passRound + 1,
      completeChains: state.chains.filter((chain) => chain.complete).length,
      totalChains: state.chains.length,
      stories:
        state.phase === "vote"
          ? state.chains.map((chain) => ({
              id: chain.id,
              starter: chain.starter.text,
              lines: chain.entries.map((entry) => entry.text),
            }))
          : null,
    };
  },
};

function nextPlayer(room, playerId) {
  const players = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  const index = players.findIndex((player) => player.id === playerId);
  if (index < 0) return players[0]?.id || null;
  return players[(index + 1) % players.length]?.id || null;
}

export default storyChain;
