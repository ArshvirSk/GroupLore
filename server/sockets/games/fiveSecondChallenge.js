import { supabase } from "../../lib/supabase.js";
import { pickRandom } from "../../utils/helpers.js";

/**
 * 5 SECOND CHALLENGE
 * One player must answer a prompt within 5 seconds, rotating turns.
 *
 * Modes:
 *  - classic: 5 seconds, name 3 things
 *  - lightning: 3 seconds, name 3 things
 *  - marathon: 10 seconds, name 5 things
 *  - hot-seat: classic but same player goes 3 rounds in a row
 */

const MODE_CONFIG = {
  classic: { timer: 5, count: 3, rounds: 8 },
  lightning: { timer: 3, count: 3, rounds: 8 },
  marathon: { timer: 10, count: 5, rounds: 6 },
  "hot-seat": { timer: 5, count: 3, rounds: 9 }, // divisible by 3 for hot-seat
};

export const handleFiveSecond = {
  async nextRound(io, sessionId, room) {
    const mode = room.gameMode || "classic";
    const config = MODE_CONFIG[mode] || MODE_CONFIG.classic;
    const TOTAL_ROUNDS = config.rounds;
    const TIMER_SECONDS = config.timer;
    const ITEM_COUNT = config.count;

    const state = room.gameState || {
      round: 0,
      currentPlayerIndex: 0,
      playerOrder: [],
      prompts: [],
      scores: {},
      timerId: null,
      groupVotes: new Map(),
      awaitingGroupVote: false,
      totalRounds: TOTAL_ROUNDS,
      timerSeconds: TIMER_SECONDS,
      itemCount: ITEM_COUNT,
    };

    // Initialize player order on first round
    if (state.playerOrder.length === 0) {
      state.playerOrder = Array.from(room.players.keys());
    }

    // Fetch prompts on first round
    if (state.prompts.length === 0) {
      const { data: profiles } = await supabase
        .from("member_profiles")
        .select("*")
        .eq("group_id", room.groupId);

      const promptTemplates = [];

      if (profiles && profiles.length > 0) {
        for (const p of profiles) {
          promptTemplates.push(`Name ${ITEM_COUNT} of ${p.display_name}'s habits`);
          promptTemplates.push(`Name ${ITEM_COUNT} of ${p.display_name}'s catchphrases`);
          promptTemplates.push(
            `Name ${ITEM_COUNT} things ${p.display_name} is most likely to do`,
          );
          promptTemplates.push(`Name ${ITEM_COUNT} of ${p.display_name}'s iconic moments`);
        }
      }

      // Add fallback prompts
      promptTemplates.push(
        `Name ${ITEM_COUNT} things the group always argues about`,
        `Name ${ITEM_COUNT} group inside jokes`,
        `Name ${ITEM_COUNT} places the group has been together`,
        `Name ${ITEM_COUNT} songs the group loves`,
        `Name ${ITEM_COUNT} foods the group always orders`,
        `Name ${ITEM_COUNT} things that would happen at a group sleepover`,
        `Name ${ITEM_COUNT} reasons why this group is chaotic`,
        `Name ${ITEM_COUNT} things that would make the group chat explode`,
      );

      state.prompts = pickRandom(
        promptTemplates,
        Math.min(state.totalRounds, promptTemplates.length),
      );
    }

    state.round++;

    if (state.round > Math.min(state.totalRounds, state.prompts.length)) {
      // Mark session as finished in DB
      supabase
        .from("game_sessions")
        .update({ status: "finished" })
        .eq("id", sessionId)
        .then();
      io.to(sessionId).emit("game-over", {
        message: "All rounds complete!",
        scores: state.scores,
      });
      return;
    }

    // Pick current player (rotate, or hot-seat: same player for 3 rounds)
    if (mode === "hot-seat") {
      state.currentPlayerIndex = Math.floor((state.round - 1) / 3) % state.playerOrder.length;
    } else {
      state.currentPlayerIndex = (state.round - 1) % state.playerOrder.length;
    }
    const currentSocketId = state.playerOrder[state.currentPlayerIndex];
    const currentPlayer = room.players.get(currentSocketId);

    room.gameState = state;

    io.to(sessionId).emit("five-second-round", {
      round: state.round,
      totalRounds: Math.min(state.totalRounds, state.prompts.length),
      prompt: state.prompts[state.round - 1],
      currentPlayer: {
        socketId: currentSocketId,
        displayName: currentPlayer?.displayName || "Unknown",
      },
      timerSeconds: state.timerSeconds,
      mode: mode,
    });

    // Start server-side timer
    if (state.timerId) clearTimeout(state.timerId);
    state.timerId = setTimeout(
      () => {
        // Time's up!
        io.to(sessionId).emit("five-second-timeout", {
          player: currentPlayer?.displayName || "Unknown",
          round: state.round,
        });
      },
      (state.timerSeconds + 1) * 1000,
    );
  },

  submitAnswer(io, socket, sessionId, room, { answer }) {
    const state = room.gameState;
    if (!state) return;

    const currentSocketId = state.playerOrder[state.currentPlayerIndex];

    // The current player submits their spoken answer text (for display)
    if (socket.id === currentSocketId) {
      // Clear timer
      if (state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
      }

      state.awaitingGroupVote = true;
      state.groupVotes = new Map();

      const player = room.players.get(socket.id);

      // Ask the group to vote: did they nail it?
      io.to(sessionId).emit("five-second-group-vote", {
        player: player?.displayName || "Unknown",
        answer: answer || "(no answer given)",
        prompt: state.prompts[state.round - 1],
        round: state.round,
        totalRounds: Math.min(state.totalRounds, state.prompts.length),
      });
      return;
    }

    // Not the current player — this is a group vote
    socket.emit("error-message", { message: "It's not your turn!" });
  },

  submitVote(io, socket, sessionId, room, { vote }) {
    const state = room.gameState;
    if (!state || !state.awaitingGroupVote) return;

    const currentSocketId = state.playerOrder[state.currentPlayerIndex];

    // Current player can't vote on themselves
    if (socket.id === currentSocketId) return;
    if (state.groupVotes.has(socket.id)) return;

    state.groupVotes.set(socket.id, vote); // 'nailed' or 'failed'

    const voterCount = room.players.size - 1; // exclude current player

    io.to(sessionId).emit("vote-count", {
      totalVotes: state.groupVotes.size,
      totalPlayers: voterCount,
    });

    // All voted
    if (state.groupVotes.size >= voterCount) {
      state.awaitingGroupVote = false;

      let nailedVotes = 0;
      let failedVotes = 0;
      for (const v of state.groupVotes.values()) {
        if (v === "nailed") nailedVotes++;
        else failedVotes++;
      }

      const success = nailedVotes > failedVotes;
      const currentPlayer = room.players.get(currentSocketId);
      const playerName = currentPlayer?.displayName || "Unknown";

      if (success) {
        state.scores[playerName] = (state.scores[playerName] || 0) + 1;
      }

      io.to(sessionId).emit("five-second-result", {
        player: playerName,
        success,
        nailedVotes,
        failedVotes,
        scores: state.scores,
        round: state.round,
        totalRounds: Math.min(state.totalRounds, state.prompts.length),
      });
    }
  },
};
