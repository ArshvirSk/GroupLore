/**
 * Persistence adapter for the engine.
 *
 * Best-effort: a failed write is logged, it never blocks or rolls back a game.
 */
export function createSupabasePersistence({
  supabase,
  logActivity,
  incrementStats,
  cleanupAttempts = 3,
  cleanupRetryDelayMs = 50,
  logger = console,
}) {
  const snapshotWrites = new Map();

  async function write(table, id, patch) {
    if (!id) return new Error(`Missing ${table} id`);
    try {
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      return error || null;
    } catch (err) {
      return err;
    }
  }

  async function markSession(sessionId, patch) {
    const err = await write("game_sessions", sessionId, patch);
    if (err) {
      logger.error("[persistence] session update failed", err.message);
    }
  }

  async function markLobby(lobbyId, patch) {
    if (!lobbyId) return;
    const err = await write("lobbies", lobbyId, patch);
    if (err) {
      logger.error("[persistence] lobby update failed", err.message);
    }
  }

  async function writeWithRetry(table, id, patch, label) {
    let lastError = null;
    for (let attempt = 1; attempt <= cleanupAttempts; attempt += 1) {
      lastError = await write(table, id, patch);
      if (!lastError) return true;
      if (attempt < cleanupAttempts && cleanupRetryDelayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, cleanupRetryDelayMs),
        );
      }
    }
    logger.error(
      `[persistence] ${label} failed after ${cleanupAttempts} attempts`,
      lastError?.message || lastError,
    );
    return false;
  }

  // Phase snapshots can be produced faster than they are written. Keep one
  // ordered write chain per session so an older phase cannot overwrite a newer
  // one after a network delay.
  function queueSnapshot(sessionId, write) {
    const previous = snapshotWrites.get(sessionId) || Promise.resolve();
    const next = previous.then(write, write);
    snapshotWrites.set(sessionId, next);
    void next.finally(() => {
      if (snapshotWrites.get(sessionId) === next) {
        snapshotWrites.delete(sessionId);
      }
    });
    return next;
  }

  return {
    async onSnapshot({ sessionId, snapshot }) {
      await queueSnapshot(sessionId, async () => {
        try {
          const { error } = await supabase
            .from("game_sessions")
            .update({
              snapshot,
              snapshot_updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
          if (error) {
            logger.error(
              "[persistence] snapshot update failed",
              error.message || error,
            );
          }
        } catch (err) {
          logger.error("[persistence] snapshot update failed", err.message);
        }
      });
    },

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
      const [sessionSaved, lobbySaved] = await Promise.all([
        writeWithRetry(
          "game_sessions",
          room.id,
          {
            status: "finished",
            snapshot: null,
            snapshot_updated_at: null,
          },
          "session cleanup",
        ),
        writeWithRetry(
          "lobbies",
          room.lobbyId,
          {
            status: "closed",
            closed_at: new Date().toISOString(),
          },
          "lobby cleanup",
        ),
      ]);

      if (!sessionSaved && !lobbySaved) {
        logger.error(
          "[persistence] cleanup could not mark the session or lobby as closed",
          room.id,
        );
      }
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
