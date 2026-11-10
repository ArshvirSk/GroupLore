import { createRequire } from "node:module";
import {
  allVoted,
  publicTally,
  tally,
  topTargets,
  votesByVoter,
} from "../engine/primitives/vote.js";

const require = createRequire(import.meta.url);
const PROMPTS = require("../data/prompts/mostLikelyTo.json");

const MODES = {
  classic: {
    label: "Classic",
    description: "Votes are secret until the reveal, then you see who picked whom",
    rounds: 5,
    voteMs: 20_000,
    revealMs: 7_000,
    showVoters: true,
  },
  anonymous: {
    label: "Anonymous",
    description: "The tally is shown, but voter names stay hidden",
    rounds: 5,
    voteMs: 20_000,
    revealMs: 7_000,
    showVoters: false,
  },
};

function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function configFor(mode) {
  return MODES[mode] || MODES.classic;
}

function choosePrompt(state) {
  if (state.usedPromptIds.length >= PROMPTS.length) state.usedPromptIds = [];
  let index = Math.floor(Math.random() * PROMPTS.length);
  let guard = 0;
  while (state.usedPromptIds.includes(PROMPTS[index].id) && guard < 500) {
    index = Math.floor(Math.random() * PROMPTS.length);
    guard += 1;
  }
  state.usedPromptIds.push(PROMPTS[index].id);
  return PROMPTS[index];
}

function beginRound(room, state) {
  const config = configFor(room.mode);
  state.round += 1;
  state.phase = "vote";
  state.votes = {};
  state.reveal = null;
  state.prompt = choosePrompt(state);
  state.endsAt = Date.now() + config.voteMs;
}

const mostLikelyTo = {
  id: "most-likely-to",
  name: "Most Likely To",
  description: "Vote for the friend who fits the prompt best.",
  emoji: "👑",
  accent: "grape",
  minPlayers: 3,
  maxPlayers: 12,
  modes: MODES,

  init(room) {
    const config = configFor(room.mode);
    const state = {
      phase: "vote",
      round: 0,
      rounds: config.rounds,
      prompt: null,
      votes: {},
      reveal: null,
      usedPromptIds: [],
      done: false,
      endsAt: null,
    };
    room.state = state;
    beginRound(room, state);
    return state;
  },

  onEvent(room, playerId, event) {
    const state = room.state;
    if (state.phase !== "vote" || event.type !== "vote") return;
    if (state.votes[playerId] !== undefined) {
      throw failure("already_voted", "You already voted this round");
    }

    const targetId = String(event.targetPlayerId || "");
    if (!room.players.has(targetId)) {
      throw failure("invalid_target", "That player is not in the room");
    }
    if (targetId === playerId) {
      throw failure("cannot_vote_self", "Pick someone else");
    }

    state.votes[playerId] = targetId;

    if (allVoted([...room.players.values()], state.votes)) {
      state.endsAt = Date.now();
    }
  },

  /**
   * Vote -> reveal -> next vote. The engine owns both timers.
   */
  onPhaseEnd(room) {
    const state = room.state;
    const config = configFor(room.mode);

    if (state.phase === "vote") {
      const validVotes = Object.fromEntries(
        Object.entries(state.votes).filter(
          ([voterId, targetId]) =>
            room.players.has(voterId) && room.players.has(targetId),
        ),
      );
      const counts = tally(validVotes);
      const top = topTargets(counts);
      const roundWinners = Object.entries(validVotes)
        .filter(([, targetId]) => top.includes(targetId))
        .map(([voterId]) => voterId);

      for (const winnerId of roundWinners) {
        room.scores[winnerId] = Number(room.scores[winnerId] || 0) + 1;
      }

      state.reveal = {
        prompt: state.prompt,
        tally: publicTally(room, counts),
        topPlayerIds: top,
        topPlayerNames: top.map(
          (playerId) => room.players.get(playerId)?.name || "Player",
        ),
        roundWinners,
        voters: config.showVoters ? votesByVoter(room, validVotes) : null,
        voteCount: Object.keys(validVotes).length,
      };
      state.phase = "reveal";
      state.endsAt = Date.now() + config.revealMs;
      return;
    }

    if (state.round >= state.rounds) {
      state.done = true;
      return "results";
    }

    beginRound(room, state);
  },

  onPlayerLeave(room, playerId) {
    const state = room.state;
    if (!state || state.phase !== "vote") return;
    delete state.votes[playerId];
    if (allVoted([...room.players.values()], state.votes)) {
      state.endsAt = Date.now();
    }
  },

  viewFor(room, viewerId) {
    const state = room.state;
    const config = configFor(room.mode);
    const activePlayers = [...room.players.values()].filter(
      (player) => player.connected,
    );

    if (state.phase === "vote") {
      return {
        phase: "vote",
        round: state.round,
        rounds: state.rounds,
        prompt: state.prompt?.text || "",
        submitted: Object.keys(state.votes).length,
        total: activePlayers.length,
        myVote: state.votes[viewerId] || null,
        mode: room.mode,
      };
    }

    return {
      phase: "reveal",
      round: state.round,
      rounds: state.rounds,
      prompt: state.prompt?.text || "",
      submitted: Object.keys(state.votes).length,
      total: activePlayers.length,
      myVote: state.votes[viewerId] || null,
      reveal: state.reveal,
      showVoters: config.showVoters,
      mode: room.mode,
    };
  },
};

export default mostLikelyTo;
