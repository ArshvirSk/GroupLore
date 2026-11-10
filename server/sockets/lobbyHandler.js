import { incrementStats, logActivity } from "../lib/activity.js";
import { supabase } from "../lib/supabase.js";
import { playerSessions, rooms } from "./index.js";

export const handleLobby = {
  /**
   * Player joins a lobby room
   */
  join(io, socket, { sessionId, userId, displayName, avatarUrl }) {
    // Create room if doesn't exist
    if (!rooms.has(sessionId)) {
      rooms.set(sessionId, {
        players: new Map(),
        hostId: null,
        gameType: null,
        groupId: null,
        gameState: null,
      });
    }

    const room = rooms.get(sessionId);

    // First player to join becomes the host
    const shouldBeHost = room.hostId === null || room.players.size === 0;

    // Add player
    room.players.set(socket.id, {
      socketId: socket.id,
      userId,
      displayName,
      avatarUrl: avatarUrl || null,
      isReady: false,
      isHost: shouldBeHost,
    });

    if (shouldBeHost) room.hostId = socket.id;

    // Track player → session mapping
    playerSessions.set(socket.id, { sessionId, userId, displayName });

    // Join socket room
    socket.join(sessionId);

    // Broadcast updated player list
    const playersList = Array.from(room.players.values());
    io.to(sessionId).emit("lobby-update", {
      players: playersList,
      hostId: room.hostId,
      gameType: room.gameType,
      gameMode: room.gameMode || "classic",
    });

    console.log(
      `👤 ${displayName} joined lobby ${sessionId} (${playersList.length} players)`,
    );
  },

  /**
   * Player leaves lobby
   */
  leave(io, socket) {
    const session = playerSessions.get(socket.id);
    if (!session) return;

    const { sessionId } = session;
    const room = rooms.get(sessionId);
    if (!room) return;

    const player = room.players.get(socket.id);
    room.players.delete(socket.id);
    playerSessions.delete(socket.id);
    socket.leave(sessionId);

    // If host left, assign new host
    if (room.hostId === socket.id && room.players.size > 0) {
      const newHost = room.players.values().next().value;
      newHost.isHost = true;
      room.hostId = newHost.socketId;
    }

    // Delete room if empty and mark session as finished
    if (room.players.size === 0) {
      rooms.delete(sessionId);
      // Mark Supabase session as finished so it won't linger
      supabase
        .from("game_sessions")
        .update({ status: "finished" })
        .eq("id", sessionId)
        .then(() =>
          console.log(`🗑️  Room ${sessionId} deleted & session finished`),
        )
        .catch(() => { });
      return;
    }

    // Broadcast updated player list
    const playersList = Array.from(room.players.values());
    io.to(sessionId).emit("lobby-update", {
      players: playersList,
      hostId: room.hostId,
      gameType: room.gameType,
    });

    io.to(sessionId).emit("player-left", {
      displayName: player?.displayName || "Unknown",
    });

    console.log(`👋 ${player?.displayName} left lobby ${sessionId}`);
  },

  /**
   * Player toggles ready state
   */
  ready(io, socket, { isReady }) {
    const session = playerSessions.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.sessionId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) player.isReady = isReady;

    const playersList = Array.from(room.players.values());
    io.to(session.sessionId).emit("lobby-update", {
      players: playersList,
      hostId: room.hostId,
      gameType: room.gameType,
    });
  },

  /**
   * Host selects game type
   */
  selectGame(io, socket, { gameType, gameMode }) {
    const session = playerSessions.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.sessionId);
    if (!room || room.hostId !== socket.id) return;

    room.gameType = gameType;
    room.gameMode = gameMode || "classic";

    io.to(session.sessionId).emit("game-selected", {
      gameType,
      gameMode: room.gameMode,
    });
  },

  /**
   * Host kicks a player
   */
  kick(io, socket, { targetSocketId }) {
    const session = playerSessions.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.sessionId);
    if (!room || room.hostId !== socket.id) return;

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit("kicked");
      targetSocket.leave(session.sessionId);
    }

    const kicked = room.players.get(targetSocketId);
    room.players.delete(targetSocketId);
    playerSessions.delete(targetSocketId);

    const playersList = Array.from(room.players.values());
    io.to(session.sessionId).emit("lobby-update", {
      players: playersList,
      hostId: room.hostId,
      gameType: room.gameType,
    });

    console.log(
      `🚫 ${kicked?.displayName} was kicked from ${session.sessionId}`,
    );
  },

  /**
   * Host starts the game
   */
  async startGame(io, socket) {
    const session = playerSessions.get(socket.id);
    if (!session) return;

    const room = rooms.get(session.sessionId);
    if (!room || room.hostId !== socket.id) return;

    if (!room.gameType) {
      socket.emit("error-message", { message: "Please select a game first!" });
      return;
    }

    if (room.players.size < 2) {
      socket.emit("error-message", { message: "Need at least 2 players!" });
      return;
    }

    // Mark session as active in Supabase so it won't be reused — AWAIT
    try {
      await supabase
        .from("game_sessions")
        .update({ status: "active", game_type: room.gameType })
        .eq("id", session.sessionId);
    } catch (err) {
      console.error("Failed to mark session active:", err);
    }

    io.to(session.sessionId).emit("game-starting", {
      gameType: room.gameType,
      sessionId: session.sessionId,
      gameMode: room.gameMode || "classic",
    });

    // Log activity: game started
    if (room.groupId) {
      const starter = room.players.get(socket.id);
      logActivity({
        groupId: room.groupId,
        userId: starter?.userId || null,
        eventType: "game_started",
        payload: {
          gameType: room.gameType,
          gameMode: room.gameMode || "classic",
          playerCount: room.players.size,
          displayName: starter?.displayName || "Host",
        },
      });
      // Increment games_played for all players
      for (const player of room.players.values()) {
        if (player.userId) {
          incrementStats(player.userId, { games_played: 1 });
        }
      }
    }

    console.log(
      `🎮 Game starting in ${session.sessionId}: ${room.gameType} (${room.gameMode || "classic"})`,
    );
  },
};
