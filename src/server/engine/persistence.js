import { recordProgression } from "../lib/progression.js";

/**
 * Persistence adapter for the engine.
 *
 * Best-effort: a failed write is logged, it never blocks or rolls back a game.
 */
export function createSupabasePersistence({
  supabase,
  logActivity,
  incrementStats,
  writeAttempts = 3,
  writeRetryDelayMs = 50,
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

  async function writeWithRetry(table, id, patch, label) {
    let lastError = null;
    for (let attempt = 1; attempt <= writeAttempts; attempt += 1) {
      lastError = await write(table, id, patch);
      if (!lastError) return true;
      if (attempt < writeAttempts && writeRetryDelayMs > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, writeRetryDelayMs),
        );
      }
    }
    logger.error(
      `[persistence] ${label} failed after ${writeAttempts} attempts`,
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
      const sessionSaved = await writeWithRetry(
        "game_sessions",
        sessionId,
        { status: "active", game_type: gameId },
        "session start",
      );
      if (!sessionSaved) {
        logger.error(
          "[persistence] session start failed; lobby left open",
          sessionId,
        );
        return;
      }

      await writeWithRetry(
        "lobbies",
        room.lobbyId,
        { status: "in_game" },
        "lobby start",
      );

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

    async onEnd({ room, sessionId, groupId, gameId, mode, ranking, scores, reason, recap }) {
      await writeWithRetry(
        "game_sessions",
        sessionId,
        {
          status: "finished",
          game_type: gameId,
          scores,
          current_round: Number(room.state?.round || 0),
          round_data: {},
          snapshot: null,
          snapshot_updated_at: null,
        },
        "session finish",
      );

      const winners = ranking.filter(
        (entry) => entry.score === ranking[0]?.score && entry.score > 0,
      );

      if (recap?.shareId) {
        try {
          const { error } = await supabase.from("session_recaps").insert({
            session_id: sessionId,
            group_id: groupId || null,
            game_type: gameId,
            mode: mode || null,
            winner_name: recap.winnerName || null,
            winner_names: recap.winnerNames || [],
            highlights: recap.highlights || [],
            scores: recap.scores || [],
            share_id: recap.shareId,
          });
          if (error) {
            logger.error(
              "[persistence] recap insert failed",
              error.message || error,
            );
          }
        } catch (err) {
          logger.error("[persistence] recap insert failed", err.message);
        }
      }

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

      if (groupId) {
        try {
          await recordProgression({
            supabase,
            groupId,
            gameId,
            ranking,
            players: room.players,
          });
        } catch (err) {
          logger.error("[persistence] progression update failed", err.message);
        }
      }
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
      const lobbySaved = await writeWithRetry(
        "lobbies",
        room.lobbyId,
        { status: "open" },
        "lobby reopen",
      );
      if (!lobbySaved) {
        logger.error(
          "[persistence] lobby reopen failed; session remains finished",
          room.id,
        );
        return;
      }

      await writeWithRetry(
        "game_sessions",
        room.id,
        {
          status: "lobby",
          scores: {},
          current_round: 0,
          round_data: {},
          snapshot: null,
          snapshot_updated_at: null,
        },
        "session lobby reset",
      );
    },

    async onHostChange({ room, hostId }) {
      await writeWithRetry(
        "lobbies",
        room.lobbyId,
        { host_id: hostId },
        "lobby host update",
      );
    },

    async onReport(payload) {
      try {
        const { error } = await supabase.from("moderation_reports").insert({
          session_id: payload.sessionId || null,
          group_id: payload.groupId || null,
          reporter_user_id: payload.reporterUserId || null,
          target_user_id: payload.targetUserId || null,
          reporter_name: payload.reporterName,
          target_name: payload.targetName,
          reason: payload.reason,
        });
        if (error) {
          logger.error(
            "[persistence] moderation report failed",
            error.message || error,
          );
          return false;
        }
        return true;
      } catch (err) {
        logger.error("[persistence] moderation report failed", err.message);
        return false;
      }
    },
  };
}
