import { incrementStats, logActivity } from "../lib/activity.js";
import { supabase } from "../lib/supabase.js";
import { handleAvoidTheAnswer } from "./games/avoidTheAnswer.js";
import { handleBestFriendTest } from "./games/bestFriendTest.js";
import { handleFiveSecond } from "./games/fiveSecondChallenge.js";
import { handleImpostor } from "./games/guessTheImpostor.js";
import { handleHigherOrLower } from "./games/higherOrLower.js";
import { handleLiarsBar } from "./games/liarsBar.js";
import { handleMostLikelyTo } from "./games/mostLikelyTo.js";
import { handleOverratedUnderrated } from "./games/overratedUnderrated.js";
import { playerSessions, rooms } from "./index.js";

const gameHandlers = {
  "overrated-underrated": handleOverratedUnderrated,
  "guess-impostor": handleImpostor,
  "five-second": handleFiveSecond,
  "best-friend-test": handleBestFriendTest,
  "most-likely-to": handleMostLikelyTo,
  "liars-bar": handleLiarsBar,
  "higher-or-lower": handleHigherOrLower,
  "avoid-the-answer": handleAvoidTheAnswer,
};

export const handleGame = {
  submitVote(io, socket, data) {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.sessionId);
    if (!room) return;

    const handler = gameHandlers[room.gameType];
    if (handler?.submitVote) {
      handler.submitVote(io, socket, session.sessionId, room, data);
    }
  },

  submitAnswer(io, socket, data) {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.sessionId);
    if (!room) return;

    const handler = gameHandlers[room.gameType];
    if (handler?.submitAnswer) {
      handler.submitAnswer(io, socket, session.sessionId, room, data);
    }
  },

  nextRound(io, socket) {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.sessionId);
    if (!room) return;

    const handler = gameHandlers[room.gameType];
    if (handler?.nextRound) {
      handler.nextRound(io, session.sessionId, room);
    }
  },

  async endGame(io, socket) {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.sessionId);
    if (!room || room.hostId !== socket.id) return;

    // Pull scores from game state (where individual games store them)
    const scores = room.gameState?.scores || room.scores || {};
    room.gameState = null;

    // Mark session as finished in Supabase — AWAIT to ensure completion
    try {
      await supabase
        .from("game_sessions")
        .update({ status: "finished" })
        .eq("id", session.sessionId);
    } catch (err) {
      console.error("Failed to mark session finished:", err);
    }

    io.to(session.sessionId).emit("game-ended", {
      scores,
    });

    // Log activity: game finished + winner stats
    if (room.groupId) {
      const entries = Object.entries(scores);
      let winner = null;
      if (entries.length > 0) {
        entries.sort((a, b) => Number(b[1]) - Number(a[1]));
        winner = entries[0][0]; // displayName of the winner
      }
      logActivity({
        groupId: room.groupId,
        eventType: "game_finished",
        payload: {
          gameType: room.gameType,
          scores,
          winner,
          playerCount: room.players.size,
        },
      });
      // Increment wins for the winner
      if (winner) {
        for (const player of room.players.values()) {
          if (player.displayName === winner && player.userId) {
            incrementStats(player.userId, { games_won: 1 });
          }
        }
      }
    }
  },

  async playAgain(io, socket) {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = rooms.get(session.sessionId);
    if (!room || room.hostId !== socket.id) return;

    room.gameState = null;
    room.gameType = null;

    // Mark old session as finished — AWAIT to ensure completion
    try {
      await supabase
        .from("game_sessions")
        .update({ status: "finished" })
        .eq("id", session.sessionId);
    } catch (err) {
      console.error("Failed to mark session finished:", err);
    }

    // Reset all players to not ready
    for (const player of room.players.values()) {
      player.isReady = false;
    }

    const playersList = Array.from(room.players.values());
    io.to(session.sessionId).emit("back-to-lobby", {
      players: playersList,
      hostId: room.hostId,
    });
  },
};
