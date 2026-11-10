import { supabase } from "../../lib/supabase.js";
import { pickRandom } from "../../utils/helpers.js";

/**
 * AVOID THE ANSWER (Taboo-style)
 * One player describes a random member without saying their banned words
 * (traits, catchphrases, habits). Others guess who it is.
 * First correct guess wins the round.
 */

const TOTAL_ROUNDS = 5;

export const handleAvoidTheAnswer = {
  async nextRound(io, sessionId, room) {
    const state = room.gameState || {
      round: 0,
      describerId: null,
      targetMember: null,
      bannedWords: [],
      guesses: new Map(),
      scores: {},
      usedDescribers: [],
      usedTargets: [],
      guessedCorrectly: false,
    };

    state.round++;
    state.guesses = new Map();
    state.guessedCorrectly = false;

    if (state.round > TOTAL_ROUNDS) {
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

    // Pick describer (rotate)
    const playerIds = Array.from(room.players.keys());
    const availableDescribers = playerIds.filter(
      (id) => !state.usedDescribers.includes(id),
    );
    state.describerId =
      availableDescribers.length > 0
        ? pickRandom(availableDescribers)
        : pickRandom(playerIds);
    state.usedDescribers.push(state.describerId);

    // Pick a target member from profiles
    const { data: profiles } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("group_id", room.groupId);

    if (!profiles || profiles.length < 2) {
      io.to(sessionId).emit("error-message", {
        message: "Need at least 2 member profiles to play!",
      });
      return;
    }

    const availableTargets = profiles.filter(
      (p) => !state.usedTargets.includes(p.display_name),
    );
    const targetProfile =
      availableTargets.length > 0
        ? pickRandom(availableTargets)
        : pickRandom(profiles);
    state.usedTargets.push(targetProfile.display_name);
    state.targetMember = targetProfile.display_name;

    // Build banned words from profile
    state.bannedWords = [
      targetProfile.display_name,
      ...(targetProfile.traits || []),
      ...(targetProfile.habits || []),
      ...(targetProfile.catchphrases || []),
      ...(targetProfile.nickname ? [targetProfile.nickname] : []),
    ];

    // All member names for guessing options
    const allNames = profiles.map((p) => p.display_name);

    room.gameState = state;

    const describerPlayer = room.players.get(state.describerId);

    // Send to describer — they see the target + banned words
    io.to(state.describerId).emit("avoid-describe", {
      round: state.round,
      totalRounds: TOTAL_ROUNDS,
      targetMember: state.targetMember,
      bannedWords: state.bannedWords,
      instruction: `Describe ${state.targetMember} WITHOUT saying these words!`,
    });

    // Send to everyone else — they'll see the description and guess
    for (const [sid] of room.players) {
      if (sid !== state.describerId) {
        io.to(sid).emit("avoid-guess", {
          round: state.round,
          totalRounds: TOTAL_ROUNDS,
          describerName: describerPlayer?.displayName || "Someone",
          memberOptions: allNames,
          message: `${describerPlayer?.displayName} is describing someone. Guess who!`,
        });
      }
    }

    // Auto-reveal after 60 seconds if no correct guess
    setTimeout(() => {
      if (!state.guessedCorrectly && state.round === room.gameState?.round) {
        io.to(sessionId).emit("avoid-reveal", {
          targetMember: state.targetMember,
          winnerId: null,
          winnerName: null,
          round: state.round,
          totalRounds: TOTAL_ROUNDS,
          scores: state.scores,
          message: "Time's up! Nobody guessed correctly.",
        });
      }
    }, 60000);
  },

  // Describer sends clues (broadcast as chat)
  submitAnswer(io, socket, sessionId, room, { clue, guess }) {
    const state = room.gameState;
    if (!state) return;

    // If it's a clue from the describer
    if (socket.id === state.describerId && clue) {
      // Check for banned words (word-boundary match to avoid false positives)
      const lower = clue.toLowerCase();
      const usedBannedWord = state.bannedWords.some((w) => {
        try {
          const escaped = w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
        } catch {
          return lower.includes(w.toLowerCase());
        }
      });

      const describerPlayer = room.players.get(state.describerId);

      io.to(sessionId).emit("avoid-clue", {
        clue,
        from: describerPlayer?.displayName || "Describer",
        violation: usedBannedWord,
      });
      return;
    }

    // If it's a guess from another player
    if (socket.id !== state.describerId && guess) {
      if (state.guessedCorrectly) return; // Already won

      const player = room.players.get(socket.id);

      if (guess === state.targetMember) {
        state.guessedCorrectly = true;
        // Guesser gets 2 points, describer gets 1 point
        const guesserName = player?.displayName || socket.id;
        const describerPlayer = room.players.get(state.describerId);
        const describerName = describerPlayer?.displayName || state.describerId;
        state.scores[guesserName] = (state.scores[guesserName] || 0) + 2;
        state.scores[describerName] =
          (state.scores[describerName] || 0) + 1;

        io.to(sessionId).emit("avoid-reveal", {
          targetMember: state.targetMember,
          winnerId: socket.id,
          winnerName: player?.displayName || "Unknown",
          round: state.round,
          totalRounds: TOTAL_ROUNDS,
          scores: state.scores,
          message: `${player?.displayName} guessed correctly!`,
        });
      } else {
        // Wrong guess — tell everyone
        io.to(sessionId).emit("avoid-wrong-guess", {
          guesserName: player?.displayName || "Unknown",
          guess,
        });
      }
    }
  },
};
