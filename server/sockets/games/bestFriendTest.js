import { supabase } from "../../lib/supabase.js";
import { pickRandom, shuffle } from "../../utils/helpers.js";

/**
 * BEST FRIEND TEST
 * Auto-generates MCQ questions from member profiles.
 * "What's [friend]'s catchphrase?" with 4 choices.
 * Score 1 point per correct answer.
 *
 * Modes:
 *  - classic: 4 options
 *  - hard: 6 options (more wrong answers)
 *  - timed: 10-second timer per question
 *  - who-said-it: match catchphrases/quotes to people
 */

const TOTAL_ROUNDS = 5;
const MODE_OPTIONS = { classic: 4, hard: 6, timed: 4, "who-said-it": 4 };

function generateQuestions(profiles, optionCount = 4) {
  const questions = [];
  const wrongNeeded = optionCount - 1;

  const fieldMap = [
    {
      field: "traits",
      label: "trait",
      question: (name) => `What's one of ${name}'s traits?`,
    },
    {
      field: "habits",
      label: "habit",
      question: (name) => `What's one of ${name}'s habits?`,
    },
    {
      field: "catchphrases",
      label: "catchphrase",
      question: (name) => `What's ${name}'s catchphrase?`,
    },
    {
      field: "most_likely_to",
      label: "most likely to",
      question: (name) => `${name} is most likely to...`,
    },
    {
      field: "iconic_moments",
      label: "iconic moment",
      question: (name) => `Which iconic moment involves ${name}?`,
    },
  ];

  for (const profile of profiles) {
    for (const { field, question } of fieldMap) {
      const items = profile[field] || [];
      if (items.length === 0) continue;

      // Get wrong answers from other profiles' same field
      const wrongPool = [];
      for (const other of profiles) {
        if (other.id === profile.id) continue;
        for (const item of other[field] || []) {
          wrongPool.push(item);
        }
      }

      if (wrongPool.length < wrongNeeded) continue; // Need enough wrong answers

      for (const correctAnswer of items) {
        const wrongAnswers = pickRandom(wrongPool, wrongNeeded);
        questions.push({
          question: question(profile.display_name),
          aboutMember: profile.display_name,
          correctAnswer,
          options: shuffle([correctAnswer, ...wrongAnswers]),
        });
      }
    }
  }

  return questions;
}

export const handleBestFriendTest = {
  async nextRound(io, sessionId, room) {
    const state = room.gameState || {
      round: 0,
      questions: [],
      answers: new Map(),
      scores: {},
    };

    // Generate questions on first round
    if (state.questions.length === 0) {
      const mode = room.gameMode || "classic";
      const optionCount = MODE_OPTIONS[mode] || 4;

      const { data: profiles } = await supabase
        .from("member_profiles")
        .select("*")
        .eq("group_id", room.groupId);

      if (!profiles || profiles.length < 2) {
        io.to(sessionId).emit("error-message", {
          message: "Need at least 2 member profiles to play Best Friend Test!",
        });
        return;
      }

      const allQuestions = generateQuestions(profiles, optionCount);
      if (allQuestions.length === 0) {
        io.to(sessionId).emit("error-message", {
          message: "Not enough profile data! Add more traits, habits, etc.",
        });
        return;
      }

      state.questions = pickRandom(
        allQuestions,
        Math.min(TOTAL_ROUNDS, allQuestions.length),
      );
    }

    state.round++;
    state.answers = new Map();

    if (state.round > state.questions.length) {
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
    const q = state.questions[state.round - 1];
    const mode = room.gameMode || "classic";

    io.to(sessionId).emit("new-round", {
      round: state.round,
      totalRounds: state.questions.length,
      prompt: {
        question: q.question,
        aboutMember: q.aboutMember,
        options: q.options,
      },
      timerSeconds: mode === "timed" ? 10 : null,
    });
  },

  submitAnswer(io, socket, sessionId, room, { answer }) {
    const state = room.gameState;
    if (!state) return;
    if (state.answers.has(socket.id)) return;

    const q = state.questions[state.round - 1];
    const isCorrect = answer === q.correctAnswer;

    state.answers.set(socket.id, { answer, isCorrect });

    if (isCorrect) {
      const player = room.players.get(socket.id);
      const name = player?.displayName || socket.id;
      state.scores[name] = (state.scores[name] || 0) + 1;
    }

    // Broadcast answer count
    io.to(sessionId).emit("vote-count", {
      totalVotes: state.answers.size,
      totalPlayers: room.players.size,
    });

    // All answered
    if (state.answers.size >= room.players.size) {
      const playerResults = [];
      for (const [sid, { answer: ans, isCorrect: correct }] of state.answers) {
        const player = room.players.get(sid);
        playerResults.push({
          socketId: sid,
          displayName: player?.displayName || "Unknown",
          answer: ans,
          isCorrect: correct,
        });
      }

      io.to(sessionId).emit("vote-results", {
        correctAnswer: q.correctAnswer,
        question: q.question,
        aboutMember: q.aboutMember,
        playerResults,
        scores: state.scores,
        round: state.round,
        totalRounds: state.questions.length,
      });
    }
  },
};
