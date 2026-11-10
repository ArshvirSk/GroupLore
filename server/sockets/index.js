import { handleGame } from "./gameHandler.js";
import { handleLobby } from "./lobbyHandler.js";

// In-memory stores
export const rooms = new Map(); // sessionId -> { players: Map, hostId, gameType, groupId }
export const playerSessions = new Map(); // socketId -> { sessionId, userId, displayName }

export function initSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    // ── Lobby Events ──
    socket.on("join-lobby", (data) => handleLobby.join(io, socket, data));
    socket.on("leave-lobby", () => handleLobby.leave(io, socket));
    socket.on("player-ready", (data) => handleLobby.ready(io, socket, data));
    socket.on("kick-player", (data) => handleLobby.kick(io, socket, data));
    socket.on("select-game", (data) =>
      handleLobby.selectGame(io, socket, data),
    );
    socket.on("start-game", () => handleLobby.startGame(io, socket));

    // ── Set group context ──
    socket.on("set-group-id", ({ groupId }) => {
      const session = playerSessions.get(socket.id);
      if (!session) return;
      const room = rooms.get(session.sessionId);
      if (room) room.groupId = groupId;
    });

    // ── Game Events ──
    socket.on("submit-vote", (data) => handleGame.submitVote(io, socket, data));
    socket.on("submit-answer", (data) =>
      handleGame.submitAnswer(io, socket, data),
    );
    socket.on("next-round", () => handleGame.nextRound(io, socket));
    socket.on("end-game", () => handleGame.endGame(io, socket));
    socket.on("play-again", () => handleGame.playAgain(io, socket));

    // ── Disconnect ──
    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.id}`);
      handleLobby.leave(io, socket);
    });
  });
}
