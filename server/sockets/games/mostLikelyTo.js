import { supabase } from "../../lib/supabase.js";
import { pickRandom } from "../../utils/helpers.js";

/**
 * MOST LIKELY TO (Top 100: Friends Group Edition)
 * "Who's most likely to [X]?" Everyone votes for a group member.
 * Reveal who got the most votes.
 */

const TOTAL_ROUNDS = 5;

const FALLBACK_PROMPTS = [
  "survive a zombie apocalypse",
  "become famous",
  "accidentally go viral",
  "cry during a movie",
  "get lost in their own city",
  "sleep through an alarm",
  "start a random business",
  "win a reality TV show",
  "become a meme",
  "ghost the group chat for a week",
  "show up late to everything",
  "forget someone's birthday",
  "eat the weirdest food combination",
  "start a fight over nothing",
  "befriend a stranger anywhere",
];

export const handleMostLikelyTo = {
  async nextRound(io, sessionId, room) {
    const state = room.gameState || {
      round: 0,
      prompts: [],
      votes: new Map(),
      memberNames: [],
      scores: {},
    };

    // Fetch prompts and member names on first round
    if (state.prompts.length === 0) {
      const { data: profiles } = await supabase
        .from("member_profiles")
        .select("*")
        .eq("group_id", room.groupId);

      state.memberNames = (profiles || []).map((p) => p.display_name);

      // Also add player names who might not have profiles
      for (const player of room.players.values()) {
        if (!state.memberNames.includes(player.displayName)) {
          state.memberNames.push(player.displayName);
        }
      }

      // Gather prompts from profiles
      const profilePrompts = [];
      for (const p of profiles || []) {
        for (const mlt of p.most_likely_to || []) {
          profilePrompts.push(mlt);
        }
      }

      // Mix profile prompts with fallbacks
      const allPrompts = [...profilePrompts, ...FALLBACK_PROMPTS];
      state.prompts = pickRandom(
        [...new Set(allPrompts)], // deduplicate
        Math.min(TOTAL_ROUNDS, allPrompts.length),
      );
    }

    state.round++;
    state.votes = new Map();

    if (state.round > state.prompts.length) {
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

    room.gameState = state;

    io.to(sessionId).emit("new-round", {
      round: state.round,
      totalRounds: state.prompts.length,
      prompt: {
        text: `Who's most likely to ${state.prompts[state.round - 1]}?`,
        options: state.memberNames,
      },
    });
  },

  submitVote(io, socket, sessionId, room, { vote }) {
    const state = room.gameState;
    if (!state) return;
    if (state.votes.has(socket.id)) return;

    state.votes.set(socket.id, vote);

    io.to(sessionId).emit("vote-count", {
      totalVotes: state.votes.size,
      totalPlayers: room.players.size,
    });

    // All voted
    if (state.votes.size >= room.players.size) {
      const tally = {};
      for (const name of state.votes.values()) {
        tally[name] = (tally[name] || 0) + 1;
      }

      // Find winner
      let maxVotes = 0;
      let winner = null;
      for (const [name, count] of Object.entries(tally)) {
        if (count > maxVotes) {
          maxVotes = count;
          winner = name;
        }
      }

      // Scoring: +1 for everyone who voted for the winner (majority rules)
      for (const [sid, votedName] of state.votes) {
        if (votedName === winner) {
          const player = room.players.get(sid);
          const name = player?.displayName || sid;
          state.scores[name] = (state.scores[name] || 0) + 1;
        }
      }

      io.to(sessionId).emit("vote-results", {
        tally,
        winner,
        scores: state.scores,
        prompt: state.prompts[state.round - 1],
        round: state.round,
        totalRounds: state.prompts.length,
      });
    }
  },
};
