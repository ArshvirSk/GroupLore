import { supabase } from "../../lib/supabase.js";
import { pickRandom, shuffle } from "../../utils/helpers.js";

/**
 * HIGHER OR LOWER
 * Pre-poll: everyone votes on traits for all members.
 * Play: show pairs, guess if next member scored higher or lower.
 * Streak-based scoring.
 */

const TOTAL_ROUNDS = 8;

const CATEGORIES = [
  "most likely to become famous",
  "most dramatic",
  "biggest foodie",
  "most likely to ghost the group chat",
  "best dressed",
  "most likely to cry first",
  "funniest",
  "most chaotic",
  "biggest procrastinator",
  "most likely to start a business",
  "most likely to survive in the wild",
  "biggest overthinker",
];

export const handleHigherOrLower = {
  async nextRound(io, sessionId, room) {
    const state = room.gameState || {
      phase: "poll", // 'poll' or 'play'
      round: 0,
      category: null,
      rankings: [], // [{name, score}] sorted
      currentIndex: 0,
      pollVotes: new Map(),
      answers: new Map(),
      scores: {},
    };

    if (state.phase === "poll") {
      // Start poll phase
      const memberNames = [];
      for (const player of room.players.values()) {
        memberNames.push(player.displayName);
      }

      // Also add profile names
      const { data: profiles } = await supabase
        .from("member_profiles")
        .select("display_name")
        .eq("group_id", room.groupId);

      for (const p of profiles || []) {
        if (!memberNames.includes(p.display_name)) {
          memberNames.push(p.display_name);
        }
      }

      state.category = pickRandom(CATEGORIES);
      state.memberNames = memberNames;
      state.pollVotes = new Map();

      room.gameState = state;

      // Ask everyone to rank all members for this category
      io.to(sessionId).emit("higher-lower-poll", {
        category: state.category,
        members: memberNames,
        instruction: `Rate each person 1-10 for: ${state.category}`,
      });
      return;
    }

    // Play phase
    state.round++;
    state.answers = new Map();

    if (state.round > Math.min(TOTAL_ROUNDS, state.rankings.length - 1)) {
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

    const current = state.rankings[state.round - 1];
    const next = state.rankings[state.round];

    io.to(sessionId).emit("new-round", {
      round: state.round,
      totalRounds: Math.min(TOTAL_ROUNDS, state.rankings.length - 1),
      prompt: {
        category: state.category,
        currentMember: current.name,
        currentScore: current.score,
        nextMember: next.name,
        question: `For "${state.category}": Does ${next.name} score HIGHER or LOWER than ${current.name} (${current.score} pts)?`,
      },
    });
  },

  // Handle poll submissions
  submitAnswer(io, socket, sessionId, room, data) {
    const state = room.gameState;
    if (!state) return;

    if (state.phase === "poll") {
      // data.ratings = { "name": score, ... }
      state.pollVotes.set(socket.id, data.ratings || data);

      io.to(sessionId).emit("vote-count", {
        totalVotes: state.pollVotes.size,
        totalPlayers: room.players.size,
      });

      if (state.pollVotes.size >= room.players.size) {
        // Average all ratings
        const totals = {};
        const counts = {};

        for (const ratings of state.pollVotes.values()) {
          for (const [name, score] of Object.entries(ratings)) {
            totals[name] = (totals[name] || 0) + score;
            counts[name] = (counts[name] || 0) + 1;
          }
        }

        state.rankings = shuffle(
          Object.entries(totals).map(([name, total]) => ({
            name,
            score: Math.round((total / counts[name]) * 10) / 10,
          }))
        );

        state.phase = "play";
        state.round = 0;

        // Trigger first play round
        this.nextRound(io, sessionId, room);
      }
      return;
    }

    // Play phase answer
    if (state.answers.has(socket.id)) return;
    state.answers.set(socket.id, data.answer); // 'higher' or 'lower'

    io.to(sessionId).emit("vote-count", {
      totalVotes: state.answers.size,
      totalPlayers: room.players.size,
    });

    if (state.answers.size >= room.players.size) {
      const next = state.rankings[state.round];
      const current = state.rankings[state.round - 1];
      const correctAnswer = next.score >= current.score ? "higher" : "lower";

      // Score correct answers (keyed by displayName)
      for (const [sid, answer] of state.answers) {
        if (answer === correctAnswer) {
          const player = room.players.get(sid);
          const name = player?.displayName || sid;
          state.scores[name] = (state.scores[name] || 0) + 1;
        }
      }

      io.to(sessionId).emit("vote-results", {
        correctAnswer,
        nextMember: next.name,
        nextScore: next.score,
        currentMember: current.name,
        currentScore: current.score,
        category: state.category,
        scores: state.scores,
        round: state.round,
        totalRounds: Math.min(TOTAL_ROUNDS, state.rankings.length - 1),
      });
    }
  },
};
