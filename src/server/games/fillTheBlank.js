import { createRequire } from "node:module";
import {
  activePlayers,
  addPoints,
  choosePrompt,
  configFor,
  failure,
  pointsList,
} from "./shared.js";
import { shuffle } from "../utils/helpers.js";

const require = createRequire(import.meta.url);
const BANK = require("../data/prompts/fillTheBlank.json");
const ANSWER_BY_ID = new Map(BANK.answers.map((card) => [card.id, card]));
const HAND_SIZE = 7;

const MODES = {
  classic: {
    label: "Classic",
    description: "A rotating judge, seven cards, first to five points",
    rounds: 20,
    playMs: 40_000,
    judgeMs: 30_000,
    revealMs: 7_000,
    target: 500,
  },
  quick: {
    label: "Quick",
    description: "Eight brisk rounds with the same judging rules",
    rounds: 8,
    playMs: 30_000,
    judgeMs: 22_000,
    revealMs: 5_000,
    target: 9_999,
  },
};

function drawCard(state) {
  if (!state.deck.length) {
    state.deck = shuffle(BANK.answers.map((card) => card.id));
  }
  return state.deck.pop();
}

function fillHand(state, playerId) {
  const hand = state.hands[playerId] || [];
  while (hand.length < HAND_SIZE) {
    const cardId = drawCard(state);
    if (!cardId || hand.includes(cardId)) break;
    hand.push(cardId);
  }
  state.hands[playerId] = hand;
}

function beginRound(room, state) {
  const config = configFor(MODES, room.mode);
  const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
  if (active.length < 3 || state.round >= state.rounds) {
    state.done = true;
    return "results";
  }

  state.round += 1;
  const previousIndex = active.findIndex((player) => player.id === state.judgeId);
  let judgeIndex = previousIndex < 0 ? 0 : (previousIndex + 1) % active.length;
  if (active[judgeIndex].id === state.skipJudgeId) {
    judgeIndex = (judgeIndex + 1) % active.length;
  }
  state.skipJudgeId = null;
  state.judgeId = active[judgeIndex].id;
  state.prompt = choosePrompt(BANK.prompts, state);
  state.points = new Map();
  state.submissions = {};
  state.winner = null;
  state.reveal = null;
  state.phase = "play";
  state.endsAt = Date.now() + config.playMs;
  for (const player of active) fillHand(state, player.id);
  return undefined;
}

function beginJudging(room, state) {
  const config = configFor(MODES, room.mode);
  state.phase = "judge";
  state.endsAt = Date.now() + config.judgeMs;
  if (Object.keys(state.submissions).length === 0) {
    state.winner = {
      playerId: null,
      cardIds: [],
      automatic: true,
      message: "Nobody played a card",
    };
    state.phase = "reveal";
    state.endsAt = Date.now() + config.revealMs;
  }
}

function resolveJudging(room, state, winnerId, automatic = false) {
  const config = configFor(MODES, room.mode);
  const submission = state.submissions[winnerId];
  if (!submission || !room.players.has(winnerId)) {
    const fallbackIds = Object.keys(state.submissions).filter((id) =>
      room.players.has(id),
    );
    winnerId = fallbackIds[Math.floor(Math.random() * fallbackIds.length)] || null;
  }
  const finalSubmission = winnerId ? state.submissions[winnerId] : null;
  const gained = finalSubmission ? 100 : 0;
  if (winnerId) addPoints(room, state.points, winnerId, gained);
  if (winnerId) {
    room.scores[winnerId] = Number(room.scores[winnerId] || 0) + gained;
  }
  state.winner = {
    playerId: winnerId,
    name: winnerId ? room.players.get(winnerId)?.name || "Player" : null,
    cardIds: finalSubmission?.cardIds || [],
    cards: (finalSubmission?.cardIds || []).map(
      (cardId) => ANSWER_BY_ID.get(cardId)?.text || "",
    ),
    automatic,
  };
  if (automatic && state.judgeId) state.skipJudgeId = state.judgeId;
  state.reveal = {
    prompt: state.prompt,
    winner: state.winner,
    submissions: Object.entries(state.submissions).map(([playerId, entry]) => ({
      playerId,
      name: room.players.get(playerId)?.name || "Player",
      cards: entry.cardIds.map((cardId) => ANSWER_BY_ID.get(cardId)?.text || ""),
      points: playerId === winnerId ? gained : 0,
    })),
    roundPoints: pointsList(room, state.points),
  };
  state.phase = "reveal";
  state.endsAt = Date.now() + config.revealMs;
}

const fillTheBlank = {
  id: "fill-the-blank",
  name: "Fill the Blank",
  description: "Judge the strangest card that completes the prompt.",
  emoji: "🃏",
  accent: "grape",
  tag: "Write",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room, mode) {
    room.mode = mode in MODES ? mode : "classic";
    const active = activePlayers(room);
    const state = {
      phase: "play",
      round: 0,
      rounds: configFor(MODES, room.mode).rounds,
      judgeId: null,
      skipJudgeId: null,
      prompt: null,
      hands: {},
      deck: shuffle(BANK.answers.map((card) => card.id)),
      submissions: {},
      winner: null,
      reveal: null,
      points: new Map(),
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    for (const player of active) state.hands[player.id] = [];
    beginRound(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "play" && event.type === "play") {
      if (playerId === state.judgeId) {
        throw failure("judge_cannot_play", "You are judging this round");
      }
      if (state.submissions[playerId]) {
        throw failure("already_played", "You already played a card");
      }
      const cardIds = Array.isArray(event.cardIds)
        ? [...new Set(event.cardIds.map(String))]
        : [];
      if (cardIds.length !== state.prompt.blanks) {
        throw failure(
          "wrong_card_count",
          `This prompt needs ${state.prompt.blanks} card${state.prompt.blanks === 1 ? "" : "s"}`,
        );
      }
      const hand = state.hands[playerId] || [];
      if (cardIds.some((cardId) => !hand.includes(cardId))) {
        throw failure("card_not_in_hand", "That card is not in your hand");
      }
      state.hands[playerId] = hand.filter((cardId) => !cardIds.includes(cardId));
      state.submissions[playerId] = {
        cardIds,
        entryId: `entry-${playerId}`,
      };
      const voters = activePlayers(room).filter(
        (player) => player.id !== state.judgeId,
      );
      if (voters.every((player) => state.submissions[player.id])) {
        beginJudging(room, state);
      }
      return;
    }

    if (state.phase === "judge" && event.type === "pick") {
      if (playerId !== state.judgeId) {
        throw failure("judge_only", "Only the judge can pick a winner");
      }
      const entryId = String(event.entryId || "");
      const winnerId = Object.keys(state.submissions).find(
        (candidate) => state.submissions[candidate].entryId === entryId,
      );
      if (!winnerId || !state.submissions[winnerId]) {
        throw failure("invalid_pick", "Pick one of the submitted cards");
      }
      resolveJudging(room, state, winnerId);
    }
  },

  onPhaseEnd(room) {
    const state = room.state;
    if (!state || state.done) return "results";
    if (state.phase === "play") {
      beginJudging(room, state);
      return;
    }
    if (state.phase === "judge") {
      const ids = Object.keys(state.submissions).filter((id) =>
        room.players.has(id),
      );
      resolveJudging(
        room,
        state,
        ids[Math.floor(Math.random() * ids.length)] || null,
        true,
      );
      return;
    }
    if (state.phase === "reveal") {
      if (
        Number(room.scores[state.winner?.playerId] || 0) >=
          configFor(MODES, room.mode).target ||
        state.round >= state.rounds
      ) {
        state.done = true;
        return "results";
      }
      beginRound(room, state);
    }
    return undefined;
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.done) return;
    delete state.hands[playerId];
    delete state.submissions[playerId];
    if (activePlayers(room).length < 3) {
      state.done = true;
      return "results";
    }
    if (playerId === state.judgeId) {
      const active = activePlayers(room).sort((a, b) => a.joinedAt - b.joinedAt);
      state.judgeId = active[0]?.id || null;
      state.submissions = {};
      state.phase = "play";
      state.endsAt = Date.now() + configFor(MODES, room.mode).playMs;
      return;
    }
    if (state.phase === "play") {
      const voters = activePlayers(room).filter(
        (player) => player.id !== state.judgeId,
      );
      if (voters.length && voters.every((player) => state.submissions[player.id])) {
        beginJudging(room, state);
      }
    }
    if (state.phase === "judge") {
      const ids = Object.keys(state.submissions);
      if (ids.length === 0) {
        beginJudging(room, state);
      }
    }
    return undefined;
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(MODES, room.mode);
    const hand = (state.hands[viewerId] || []).map((cardId) => ({
      id: cardId,
      text: ANSWER_BY_ID.get(cardId)?.text || "",
    }));
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      blanks: state.prompt?.blanks || 1,
      isJudge: viewerId === state.judgeId,
      judgeName: room.players.get(state.judgeId)?.name || "Player",
      submitted: Object.keys(state.submissions).length,
      total: Math.max(0, activePlayers(room).length - 1),
      score: Number(room.scores[viewerId] || 0),
      target: config.target,
    };
    if (state.phase === "play") {
      return {
        ...base,
        hand,
        youPlayed: Boolean(state.submissions[viewerId]),
        playMs: config.playMs,
      };
    }
    if (state.phase === "judge") {
      return {
        ...base,
        options: Object.entries(state.submissions).map(([, entry]) => ({
          id: entry.entryId,
          cards: entry.cardIds.map((cardId) => ANSWER_BY_ID.get(cardId)?.text || ""),
          label: "Anonymous entry",
        })),
        judgeMs: config.judgeMs,
      };
    }
    return { ...base, reveal: state.reveal };
  },

  publicFor(room) {
    const state = room.state;
    const base = {
      phase: state.phase,
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      judgeName: room.players.get(state.judgeId)?.name || "Player",
    };
    if (state.phase === "play") return { ...base, submitted: Object.keys(state.submissions).length };
    if (state.phase === "judge") {
      const entries = Object.keys(state.submissions).length;
      return { ...base, entries };
    }
    return { ...base, reveal: state.reveal };
  },
};

export default fillTheBlank;
