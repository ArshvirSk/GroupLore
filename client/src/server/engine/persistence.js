/**
 * Persistence adapter for the engine.
 *
 * Best-effort: a failed write is logged, it never blocks or rolls back a game.
 */
export function createSupabasePersistence({
  supabase,
  logActivity,
  incrementStats,
  logger = console,
}) {
  async function markSession(sessionId, patch) {
    try {
      await supabase.from("game_sessions").update(patch).eq("id", sessionId);
    } catch (err) {
      logger.error("[persistence] session update failed", err.message);
    }
  }

  async function markLobby(lobbyId, patch) {
    if (!lobbyId) return;
    try {
      await supabase.from("lobbies").update(patch).eq("id", lobbyId);
    } catch (err) {
      logger.error("[persistence] lobby update failed", err.message);
    }
  }

  return {
    async onStart({ room, gameId, mode, sessionId, groupId }) {
      await markSession(sessionId, { status: "active", game_type: gameId });
      await markLobby(room.lobbyId, { status: "in_game" });

      if (!groupId) return;
      const host = room.players.get(room.hostId);
      await logActivity({
        groupId,
        userId: host?.userId || null,
        eventType: "game_started",
        payload: {
          gameType: gameId,
          gameMode: mode,
          playerCount: room.players.size,
          displayName: host?.name || "Host",
        },
      });
    },

    async onEnd({ room, sessionId, groupId, gameId, mode, ranking, scores, reason }) {
      await markSession(sessionId, {
        status: "finished",
        game_type: gameId,
        scores,
        current_round: Number(room.state?.round || 0),
        round_data: {},
      });

      const winners = ranking.filter(
        (entry) => entry.score === ranking[0]?.score && entry.score > 0,
      );

      if (groupId) {
        await logActivity({
          groupId,
          eventType: "game_finished",
          payload: {
            gameType: gameId,
            gameMode: mode,
            scores,
            winner: winners[0]?.name || null,
            winners: winners.map((entry) => entry.name),
            playerCount: room.players.size,
            reason,
          },
        });
      }

      const tasks = [];
      for (const player of room.players.values()) {
        if (!player.userId) continue;
        const won = winners.some((entry) => entry.playerId === player.id);
        tasks.push(
          incrementStats(player.userId, {
            games_played: 1,
            ...(won ? { games_won: 1 } : {}),
          }),
        );
      }
      await Promise.allSettled(tasks);
    },

    async onEmpty({ room }) {
      await markSession(room.id, { status: "finished" });
      await markLobby(room.lobbyId, {
        status: "closed",
        closed_at: new Date().toISOString(),
      });
    },

    async onLobby({ room }) {
      await markSession(room.id, {
        status: "lobby",
        scores: {},
        current_round: 0,
        round_data: {},
      });
      await markLobby(room.lobbyId, { status: "open" });
    },

    async onHostChange({ room, hostId }) {
      await markLobby(room.lobbyId, { host_id: hostId });
    },
  };
}
