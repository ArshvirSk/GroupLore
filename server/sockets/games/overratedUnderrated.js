import { supabase } from "../../lib/supabase.js";
import { pickRandom } from "../../utils/helpers.js";

/**
 * OVERRATED / UNDERRATED
 * Players vote on whether a context item is overrated or underrated.
 */

const TOTAL_ROUNDS = 5;

export const handleOverratedUnderrated = {
  async nextRound(io, sessionId, room) {
    const state = room.gameState || { round: 0, prompts: [], votes: new Map(), scores: {} };

    // Fetch prompts on first round
    if (state.prompts.length === 0) {
      const { data: profiles } = await supabase
        .from("member_profiles")
        .select("*")
        .eq("group_id", room.groupId);

      if (!profiles || profiles.length === 0) {
        io.to(sessionId).emit("error-message", {
          message: "No member profiles found! Add some group context first.",
        });
        return;
      }

      // Gather all prompts from member data
      const allPrompts = [];
      for (const p of profiles) {
        for (const h of p.habits || [])
          allPrompts.push({ text: h, source: p.display_name, type: "habit" });
        for (const m of p.iconic_moments || [])
          allPrompts.push({ text: m, source: p.display_name, type: "moment" });
        for (const c of p.catchphrases || [])
          allPrompts.push({
            text: c,
            source: p.display_name,
            type: "catchphrase",
          });
        for (const t of p.most_likely_to || [])
          allPrompts.push({
            text: t,
            source: p.display_name,
            type: "mostLikelyTo",
          });
      }

      if (allPrompts.length === 0) {
        // Use fallback prompts
        state.prompts = [
          { text: "Pizza parties", source: "GroupLore", type: "fun" },
          {
            text: "Late night study sessions",
            source: "GroupLore",
            type: "fun",
          },
          { text: "Group selfies", source: "GroupLore", type: "fun" },
          {
            text: "Voice notes in group chat",
            source: "GroupLore",
            type: "fun",
          },
          {
            text: "Making plans that never happen",
            source: "GroupLore",
            type: "fun",
          },
        ];
      } else {
        state.prompts = pickRandom(
          allPrompts,
          Math.min(TOTAL_ROUNDS, allPrompts.length),
        );
      }
    }

    state.round++;
    state.votes = new Map();

    if (state.round > Math.min(TOTAL_ROUNDS, state.prompts.length)) {
      // Mark session as finished in DB
      supabase
        .from("game_sessions")
        .update({ status: "finished" })
        .eq("id", sessionId)
        .then();
      io.to(sessionId).emit("game-over", { message: "All rounds complete!", scores: state.scores });
      return;
    }

    room.gameState = state;

    const currentPrompt = state.prompts[state.round - 1];

    io.to(sessionId).emit("new-round", {
      round: state.round,
      totalRounds: Math.min(TOTAL_ROUNDS, state.prompts.length),
      prompt: currentPrompt,
    });
  },

  submitVote(io, socket, sessionId, room, { vote }) {
    const state = room.gameState;
    if (!state) return;

    // Prevent duplicate voting
    if (state.votes.has(socket.id)) {
      socket.emit("error-message", { message: "You already voted!" });
      return;
    }

    state.votes.set(socket.id, vote); // 'overrated' or 'underrated'

    const totalPlayers = room.players.size;
    const totalVotes = state.votes.size;

    io.to(sessionId).emit("vote-count", {
      totalVotes,
      totalPlayers,
    });

    // All votes in
    if (totalVotes >= totalPlayers) {
      const results = { overrated: 0, underrated: 0 };
      for (const v of state.votes.values()) {
        results[v]++;
      }

      const total = results.overrated + results.underrated;
      const percentage = {
        overrated: Math.round((results.overrated / total) * 100),
        underrated: Math.round((results.underrated / total) * 100),
      };

      // Majority-rules scoring: +1 for voting with the majority
      const majority = results.overrated >= results.underrated ? "overrated" : "underrated";
      for (const [sid, v] of state.votes) {
        if (v === majority) {
          const player = room.players.get(sid);
          const name = player?.displayName || sid;
          state.scores[name] = (state.scores[name] || 0) + 1;
        }
      }

      io.to(sessionId).emit("vote-results", {
        results,
        percentage,
        majority,
        scores: state.scores,
        prompt: state.prompts[state.round - 1],
        round: state.round,
        totalRounds: Math.min(TOTAL_ROUNDS, state.prompts.length),
      });
    }
  },
};
