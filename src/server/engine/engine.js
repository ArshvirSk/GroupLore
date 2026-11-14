import { getGame, listGames } from "../games/index.js";
import { contentAllowed, contentForGame } from "../games/content.js";
import { socketRateLimit } from "../lib/rateLimit.js";
import { signReconnectToken, verifySignedToken } from "./auth.js";
import { recordLatency } from "./primitives/latency.js";
import {
  autoBalance,
  removeFromTeams,
  syncTeams,
  teamsView,
  validateTeams,
} from "./teams.js";

const MAX_EVENT_ID_LENGTH = 64;
const MAX_SEEN_EVENTS = 50;
const TICK_MS = 15;
const DEFAULT_RESTORE_TIMEOUT_MS = 5 * 60_000;
const REPORT_REASONS = new Set(["harassment", "hate", "sexual", "spam", "other"]);

function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function publicError(err) {
  if (err?.code && /^[a-z][a-z0-9_]{1,40}$/.test(err.code)) {
    return { code: err.code, message: err.message || "Something went wrong" };
  }
  return { code: "server_error", message: "Something went wrong" };
}

/**
 * Server-authoritative room engine.
 *
 * Lifecycle: lobby -> playing -> results -> lobby.
 * The engine owns every timer and every phase transition. Clients only send
 * intents; they never advance a round or move a phase.
 *
 * A game module supplies:
 *   id, name, description, minPlayers, maxPlayers, modes
 *   init(room, mode) -> state
 *   onEvent(room, playerId, event) -> void | "results"
 *   onPhaseEnd(room, { reason }) -> void | "results"
 *   onPlayerLeave?(room, playerId)
 *   viewFor(room, viewerId) -> JSON
 *   publicFor?(room) -> JSON shown to read-only TV spectators
 *
 * Phase timing is expressed as an absolute `state.endsAt` epoch-ms. The engine
 * arms a single timeout per room and clears it whenever the room is destroyed.
 */
export class GameEngine {
  constructor({
    resolveIdentity,
    authorize,
    loadSession,
    findOpenSession = null,
    restoreOneSession = null,
    persistence = null,
    disconnectGraceMs = 30_000,
    restoreTimeoutMs = DEFAULT_RESTORE_TIMEOUT_MS,
    logger = console,
  }) {
    this.resolveIdentity = resolveIdentity;
    this.authorize = authorize;
    this.loadSession = loadSession;
    this.findOpenSession = findOpenSession;
    this.restoreOneSession = restoreOneSession;
    this.persistence = persistence;
    this.disconnectGraceMs = disconnectGraceMs;
    const parsedRestoreTimeout = Number(restoreTimeoutMs);
    this.restoreTimeoutMs =
      Number.isFinite(parsedRestoreTimeout) && parsedRestoreTimeout > 0
        ? parsedRestoreTimeout
        : DEFAULT_RESTORE_TIMEOUT_MS;
    this.logger = logger;

    this.rooms = new Map();
    this.loadingRooms = new Map();
    this.restorePromise = null;
    this.closedRestores = new Set();
    this.connections = new Map();
  }

  connect(connection) {
    this.connections.set(connection.id, connection);
    this.onConnection(connection);
    return connection;
  }

  disconnect(connection) {
    if (connection.latencyTimer) clearInterval(connection.latencyTimer);
    if (connection.data) connection.data.latencyPings?.clear?.();
    this.connections.delete(connection.id);
    this.onDisconnect(connection);
  }

  onConnection(socket) {
    socket.emit("room:hello", { serverNow: Date.now() });

    // Server-measured RTT: the client only echoes an opaque ping id, so a
    // client cannot improve its reaction time by reporting a fake timestamp.
    socket.data = socket.data || {};
    socket.data.latencyPings = new Map();
    const ping = () => {
      if (socket.connected === false) return;
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      socket.data.latencyPings.set(id, Date.now());
      if (socket.data.latencyPings.size > 20) {
        socket.data.latencyPings.delete(
          socket.data.latencyPings.keys().next().value,
        );
      }
      socket.emit("latency:ping", { id });
    };
    ping();
    if (socket.latencyTimer) clearInterval(socket.latencyTimer);
    socket.latencyTimer = setInterval(ping, 15_000);
    socket.latencyTimer.unref?.();

    // Resume an in-progress room after a refresh. The client may also emit
    // room:join explicitly; join is idempotent for the same identity.
    if (typeof this.findOpenSession === "function") {
      void Promise.resolve(this.findOpenSession(socket))
        .then((sessionId) => {
          if (!sessionId || !socket.connected) return;
          return this.join(socket, { sessionId });
        })
        .catch((err) =>
          this.logger.error("[engine] auto-rejoin failed", err?.message || err),
        );
    }

    socket.on("room:join", (payload) => {
      this.safe(socket, () => this.join(socket, payload));
    });
    socket.on("room:spectate", (payload) => {
      this.safe(socket, () => this.spectate(socket, payload));
    });
    socket.on("room:leave", () => {
      this.safe(socket, () => this.leave(socket));
    });
    socket.on("room:action", (payload) => {
      this.safe(socket, () => this.action(socket, payload));
    });
    socket.on("game:event", (payload) => {
      this.safe(socket, () => this.gameEvent(socket, payload));
    });
    socket.on("room:sync-request", () => {
      const spectatorRoom = this.spectatorContext(socket);
      if (spectatorRoom) {
        socket.emit("room:sync", this.publicView(spectatorRoom));
        return;
      }
      const ctx = this.context(socket);
      if (ctx) socket.emit("room:sync", this.view(ctx.room, ctx.player.id));
    });
    socket.on("disconnect", () => this.onDisconnect(socket));
  }

  async safe(socket, fn) {
    if (!socketRateLimit(socket)) {
      socket.emit("room:error", {
        code: "rate_limited",
        message: "Too many actions. Slow down for a moment.",
      });
      return;
    }
    try {
      await fn();
    } catch (err) {
      if (!err?.code || !/^[a-z][a-z0-9_]{1,40}$/.test(err.code)) {
        this.logger.error("[engine]", err);
      }
      socket.emit("room:error", publicError(err));
    }
  }

  context(socket) {
    const room = this.rooms.get(socket.data.roomId);
    if (!room) return null;
    const player = room.players.get(socket.data.playerId);
    if (!player || player.socketId !== socket.id) return null;
    return { room, player };
  }

  spectatorContext(socket) {
    const room = this.rooms.get(socket.data.roomId);
    if (!room || !socket.data.spectating) return null;
    return room.spectators.has(socket.id) ? room : null;
  }

  hostOnly(room, player) {
    if (room.hostId !== player.id) {
      throw failure("host_only", "Only the host can do that");
    }
  }

  ensureRoomLive(room) {
    if (this.rooms.get(room.id) !== room) {
      throw failure("room_closed", "That room is no longer open");
    }
  }

  inPhase(room, phase, message) {
    if (room.phase !== phase) {
      throw failure("wrong_phase", message || "That is not available right now");
    }
  }

  accept(room, playerId, eventId) {
    if (eventId === undefined || eventId === null || eventId === "") return true;
    if (typeof eventId !== "string" || eventId.length > MAX_EVENT_ID_LENGTH) {
      return false;
    }
    let seen = room.seen.get(playerId);
    if (!seen) {
      seen = new Set();
      room.seen.set(playerId, seen);
    }
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    if (seen.size > MAX_SEEN_EVENTS) {
      seen.delete(seen.values().next().value);
    }
    return true;
  }

  async getRoom(sessionId) {
    const existing = this.rooms.get(sessionId);
    if (existing) return existing;
    if (this.closedRestores.has(sessionId)) {
      throw failure("session_finished", "That game has already finished");
    }

    if (this.loadingRooms.has(sessionId)) {
      return this.loadingRooms.get(sessionId);
    }

    const loading = (async () => {
      const session = await this.loadSession(sessionId);
      if (!session) {
        throw failure("session_not_found", "That room no longer exists");
      }
      if (
        session.status === "finished" ||
        session.lobbies?.status === "closed"
      ) {
        throw failure("session_finished", "That game has already finished");
      }
      const cached = this.rooms.get(sessionId);
      if (cached) return cached;

      const room =
        this.roomFromSnapshot(session) ||
        this.createRoom({
          id: session.id || sessionId,
          groupId:
            session.lobbies?.group_id || session.group_id || session.groupId || null,
          lobbyId: session.lobby_id || session.lobbies?.id || null,
          session,
        });
      this.rooms.set(room.id, room);
      this.scheduleRestoreCleanup(room);
      return room;
    })();

    this.loadingRooms.set(sessionId, loading);
    try {
      return await loading;
    } finally {
      this.loadingRooms.delete(sessionId);
    }
  }

  createRoom({ id, groupId, lobbyId, session = null }) {
    const sessionGame = session?.game_type ? getGame(session.game_type) : null;
    const allowedSessionGame =
      sessionGame && contentAllowed(contentForGame(sessionGame.id))
        ? sessionGame
        : null;
    return {
      id,
      groupId,
      lobbyId: lobbyId || null,
      groupName: session?.lobbies?.groups?.name || session?.groups?.name || null,
      joinCode: session?.lobbies?.code || session?.groups?.join_code || null,
      session,
      players: new Map(),
      spectators: new Set(),
      hostId: null,
      phase: "lobby",
      gameId: allowedSessionGame?.id || null,
      mode: allowedSessionGame
        ? allowedSessionGame.modes.classic
          ? "classic"
          : Object.keys(allowedSessionGame.modes)[0]
        : null,
      module: null,
      state: null,
      scores: {},
      teams: null,
      teamsLocked: false,
      latency: {},
      result: null,
      endsAt: null,
      timer: null,
      paused: false,
      pausedRemainingMs: null,
      restoreTimer: null,
      version: 0,
      advancing: false,
      endPersisted: false,
      reports: new Set(),
      seen: new Map(),
      createdAt: Date.now(),
    };
  }

  /**
   * Rehydrate a playing room from its last phase-boundary snapshot. Players
   * come back as disconnected seats so a reconnect token or identity can
   * reclaim them. The room starts paused and resumes its stored remaining
   * phase time only once a player reconnects.
   */
  roomFromSnapshot(session) {
    let snapshot = session?.snapshot;
    if (typeof snapshot === "string") {
      try {
        snapshot = JSON.parse(snapshot);
      } catch {
        return null;
      }
    }
    if (
      !snapshot ||
      snapshot.version !== 1 ||
      snapshot.phase !== "playing" ||
      !snapshot.state ||
      snapshot.state.done
    ) {
      return null;
    }

    const game = getGame(snapshot.gameId);
    if (
      !game ||
      !game.modes[snapshot.mode] ||
      !contentAllowed(contentForGame(game.id))
    ) {
      return null;
    }

    const room = this.createRoom({
      id: session.id,
      groupId:
        session.lobbies?.group_id || session.group_id || snapshot.groupId || null,
      lobbyId: session.lobby_id || session.lobbies?.id || snapshot.lobbyId || null,
      session,
    });
    room.phase = "playing";
    room.gameId = game.id;
    room.mode = snapshot.mode;
    room.module = game;
    room.state = JSON.parse(JSON.stringify(snapshot.state));
    room.scores = { ...(snapshot.scores || {}) };
    room.teams = snapshot.teams
      ? JSON.parse(JSON.stringify(snapshot.teams))
      : null;
    room.teamsLocked = Boolean(snapshot.teamsLocked);
    room.reports = new Set(
      Array.isArray(snapshot.reports) ? snapshot.reports : [],
    );
    room.result = null;
    room.endPersisted = false;
    room.createdAt = Number(snapshot.createdAt) || Date.now();

    for (const saved of snapshot.players || []) {
      if (!saved?.id) continue;
      room.players.set(saved.id, {
        id: saved.id,
        identityKey: saved.identityKey,
        kind: saved.kind,
        guestId: saved.guestId || null,
        authUserId: saved.authUserId || null,
        userId: saved.userId || null,
        isGuest: Boolean(saved.isGuest),
        name: saved.name || "Player",
        avatarUrl: saved.avatarUrl || null,
        isReady: Boolean(saved.isReady),
        muted: Boolean(saved.muted),
        socketId: null,
        connected: false,
        joinedAt: Number(saved.joinedAt) || room.createdAt,
        graceTimer: null,
      });
      room.latency[saved.id] = [];
    }

    room.hostId = room.players.has(snapshot.hostId)
      ? snapshot.hostId
      : room.players.keys().next().value || null;

    room.paused = true;
    room.pausedRemainingMs =
      snapshot.remainingMs !== null &&
      snapshot.remainingMs !== undefined &&
      Number.isFinite(Number(snapshot.remainingMs))
      ? Math.max(0, Number(snapshot.remainingMs))
      : null;

    return room;
  }

  remainingPhaseMs(room) {
    if (room.phase !== "playing") return null;
    if (room.paused) {
      return room.pausedRemainingMs !== null &&
        room.pausedRemainingMs !== undefined &&
        Number.isFinite(Number(room.pausedRemainingMs))
        ? Math.max(0, Number(room.pausedRemainingMs))
        : null;
    }
    return Number.isFinite(Number(room.state?.endsAt))
      ? Math.max(0, Number(room.state.endsAt) - Date.now())
      : null;
  }

  resumePhaseTimer(room) {
    if (!room.paused || room.phase !== "playing") return;
    if (room.restoreTimer) clearTimeout(room.restoreTimer);
    room.restoreTimer = null;
    const remainingMs = room.pausedRemainingMs;
    room.paused = false;
    room.pausedRemainingMs = null;

    if (
      remainingMs !== null &&
      remainingMs !== undefined &&
      Number.isFinite(Number(remainingMs))
    ) {
      room.state = room.state || {};
      room.state.endsAt = Date.now() + Math.max(TICK_MS, Number(remainingMs));
    }

    this.arm(room);
    this.persistSnapshot(room, "resume");
  }

  scheduleRestoreCleanup(room) {
    if (!room.paused) return;
    if (room.restoreTimer) clearTimeout(room.restoreTimer);
    room.restoreTimer = setTimeout(() => {
      room.restoreTimer = null;
      if (!room.paused || room.phase !== "playing") return;
      if ([...room.players.values()].some((player) => player.connected)) return;
      this.destroyRoom(room, "restore_timeout");
    }, this.restoreTimeoutMs);
    room.restoreTimer.unref?.();
  }

  snapshotRoom(room) {
    return {
      version: 1,
      sessionId: room.id,
      groupId: room.groupId,
      lobbyId: room.lobbyId,
      groupName: room.groupName,
      joinCode: room.joinCode,
      phase: room.phase,
      gameId: room.gameId,
      mode: room.mode,
      hostId: room.hostId,
      players: [...room.players.values()].map((player) => ({
        id: player.id,
        identityKey: player.identityKey,
        kind: player.kind,
        guestId: player.guestId,
        authUserId: player.authUserId,
        userId: player.userId,
        isGuest: player.isGuest,
        name: player.name,
        avatarUrl: player.avatarUrl,
        isReady: player.isReady,
        muted: player.muted,
        joinedAt: player.joinedAt,
      })),
      scores: { ...room.scores },
      teams: room.teams ? JSON.parse(JSON.stringify(room.teams)) : null,
      teamsLocked: room.teamsLocked,
      reports: [...room.reports],
      state: room.state ? JSON.parse(JSON.stringify(room.state)) : null,
      result: room.result ? JSON.parse(JSON.stringify(room.result)) : null,
      remainingMs: this.remainingPhaseMs(room),
      createdAt: room.createdAt,
      savedAt: Date.now(),
    };
  }

  persistSnapshot(room, reason) {
    if (!this.persistence?.onSnapshot) return;
    let snapshot;
    try {
      snapshot = this.snapshotRoom(room);
    } catch (err) {
      this.logger.error("[engine] snapshot failed", err?.message || err);
      return;
    }
    void Promise.resolve(
      this.persistence.onSnapshot({ room, sessionId: room.id, snapshot, reason }),
    ).catch((err) =>
      this.logger.error("[engine] onSnapshot failed", err?.message || err),
    );
  }

  async restoreLiveRoom() {
    if (this.restorePromise) return this.restorePromise;
    if (typeof this.restoreOneSession !== "function") return null;

    this.restorePromise = (async () => {
      const session = await this.restoreOneSession();
      if (!session) return null;
      const room = this.roomFromSnapshot(session);
      if (!room) return null;
      if (this.rooms.has(room.id)) return this.rooms.get(room.id);
      this.rooms.set(room.id, room);
      this.scheduleRestoreCleanup(room);
      return room;
    })();

    return this.restorePromise;
  }

  async join(socket, payload = {}) {
    if (socket.data.spectating) {
      throw failure("already_spectating", "Open the game in a separate tab");
    }
    const sessionId = String(payload.sessionId || "");
    if (!sessionId) throw failure("session_required", "Missing room id");

    const existingCtx = this.context(socket);
    if (existingCtx && existingCtx.room.id === sessionId) {
      socket.emit("room:sync", this.view(existingCtx.room, existingCtx.player.id));
      return;
    }

    const room = await this.getRoom(sessionId);
    const identity = socket.data.identity;
    const auth = await this.authorize({
      identity,
      groupId: room.groupId,
      lobbyId: room.lobbyId,
      session: room.session,
    });
    if (!auth?.allowed || !(auth.userId || identity.authUserId)) {
      throw failure("not_in_lobby", "Join this lobby first");
    }

    // Authorization is async, so the restore cleanup may have destroyed the
    // room while we waited. Never attach a player to a detached room object.
    this.ensureRoomLive(room);

    const stableId = auth.userId || identity.authUserId;
    const identityKey = `u:${stableId}`;
    const reconnect = payload.reconnectToken
      ? verifySignedToken(payload.reconnectToken)
      : null;

    let player = null;
    if (
      reconnect?.kind === "reconnect" &&
      reconnect.sid === room.id &&
      room.players.has(reconnect.pid)
    ) {
      player = room.players.get(reconnect.pid);
    } else {
      player = [...room.players.values()].find(
        (candidate) => candidate.identityKey === identityKey,
      );
    }

    const pauseJoin =
      room.phase === "playing" &&
      room.module?.canJoinDuringPause?.(room);
    if (!player && room.phase !== "lobby" && !pauseJoin) {
      throw failure("game_in_progress", "That game is already in progress");
    }

    if (player) {
      const oldSocketId = player.socketId;
      if (oldSocketId && oldSocketId !== socket.id) {
        const old = this.connections.get(oldSocketId);
        if (old) {
          old.emit("room:error", {
            code: "session_replaced",
            message: "This player opened the game in another tab",
          });
          old.data.roomId = null;
          old.data.playerId = null;
          old.close?.();
          this.connections.delete(oldSocketId);
        }
      }

      if (player.graceTimer) {
        clearTimeout(player.graceTimer);
        player.graceTimer = null;
      }
      player.socketId = socket.id;
      player.connected = true;
      player.name = player.name || auth.name || identity.name;
      this.bindSocket(socket, room, player);
      this.sendJoined(socket, room, player);
      this.playerJoinedGame(room, player.id);
      this.resumePhaseTimer(room);
      this.broadcast(room);
      return;
    }

    player = {
      id: stableId,
      identityKey,
      kind: identity.kind,
      guestId: null,
      authUserId: identity.authUserId || null,
      userId: auth.userId || identity.authUserId || null,
      isGuest: Boolean(identity.isGuest),
      name: auth.name || identity.name || "Player",
      avatarUrl: auth.avatarUrl || identity.avatarUrl || null,
      isReady: false,
      muted: false,
      socketId: socket.id,
      connected: true,
      joinedAt: Date.now(),
      graceTimer: null,
    };
    room.players.set(player.id, player);
    room.latency[player.id] = room.latency[player.id] || [];
    const selectedGame = room.gameId ? getGame(room.gameId) : null;
    if (selectedGame?.teams && !room.teams?.length && room.phase === "lobby") {
      room.teams = autoBalance(
        [...room.players.keys()],
        selectedGame.teams.count,
      );
    }
    if (room.teams?.length) syncTeams(room, [...room.players.keys()]);

    if (!room.hostId) room.hostId = player.id;

    this.bindSocket(socket, room, player);
    this.sendJoined(socket, room, player);
    this.playerJoinedGame(room, player.id);
    this.broadcast(room);
  }

  playerJoinedGame(room, playerId) {
    if (room.phase !== "playing" || !room.module?.onPlayerJoin) return;
    try {
      const previousPhase = room.state?.phase;
      room.module.onPlayerJoin(room, playerId);
      if (room.state?.done) {
        this.finish(room, "completed");
        return;
      }
      this.arm(room);
      if (previousPhase !== room.state?.phase) {
        this.persistSnapshot(room, "phase");
      }
    } catch (err) {
      this.logger.error("[engine] onPlayerJoin failed", err);
    }
  }

  bindSocket(socket, room, player) {
    socket.data.roomId = room.id;
    socket.data.playerId = player.id;
    socket.data.spectating = false;
  }

  sendJoined(socket, room, player) {
    const reconnectToken = signReconnectToken({
      sessionId: room.id,
      playerId: player.id,
    });
    socket.emit("room:joined", {
      sessionId: room.id,
      playerId: player.id,
      reconnectToken,
      serverNow: Date.now(),
    });
    socket.emit("room:sync", this.view(room, player.id));
  }

  async spectate(socket, payload = {}) {
    const sessionId = String(payload.sessionId || "");
    if (!sessionId) throw failure("session_required", "Missing room id");
    if (socket.data.playerId) {
      throw failure("already_playing", "A player cannot spectate the same room");
    }

    const existing = this.spectatorContext(socket);
    if (existing && existing.id === sessionId) {
      socket.emit("room:sync", this.publicView(existing));
      return;
    }

    const room = await this.getRoom(sessionId);
    const auth = await this.authorize({
      identity: socket.data.identity,
      groupId: room.groupId,
      lobbyId: room.lobbyId,
      session: room.session,
    });
    if (!auth?.allowed) {
      throw failure("not_in_lobby", "Join this lobby first");
    }

    this.ensureRoomLive(room);

    socket.data.roomId = room.id;
    socket.data.spectating = true;
    socket.data.playerId = null;
    room.spectators.add(socket.id);
    socket.emit("room:spectate-joined", {
      sessionId: room.id,
      serverNow: Date.now(),
    });
    socket.emit("room:sync", this.publicView(room));
  }

  async leave(socket) {
    const spectatorRoom = this.spectatorContext(socket);
    if (spectatorRoom) {
      spectatorRoom.spectators.delete(socket.id);
      socket.data.roomId = null;
      socket.data.spectating = false;
      socket.emit("room:left", {});
      return;
    }

    const ctx = this.context(socket);
    if (!ctx) return;
    socket.data.roomId = null;
    socket.data.playerId = null;
    this.removePlayer(ctx.room, ctx.player.id, "left");
    socket.emit("room:left", {});
  }

  onDisconnect(socket) {
    const room = this.rooms.get(socket.data.roomId);
    if (!room) return;
    if (socket.data.spectating) {
      room.spectators.delete(socket.id);
      socket.data.roomId = null;
      socket.data.spectating = false;
      return;
    }
    const player = room.players.get(socket.data.playerId);
    if (!player || player.socketId !== socket.id) return;

    player.connected = false;
    player.socketId = null;
    socket.data.roomId = null;
    socket.data.playerId = null;

    if (player.graceTimer) clearTimeout(player.graceTimer);
    player.graceTimer = setTimeout(() => {
      player.graceTimer = null;
      const current = this.rooms.get(room.id);
      if (current) this.removePlayer(current, player.id, "disconnected");
    }, this.disconnectGraceMs);
    player.graceTimer.unref?.();

    this.broadcast(room);
  }

  removePlayer(room, playerId, reason) {
    const player = room.players.get(playerId);
    if (!player) return;
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }

    room.players.delete(playerId);
    removeFromTeams(room, playerId);
    delete room.latency[playerId];
    room.seen.delete(playerId);
    delete room.scores[playerId];

    if (room.hostId === playerId) {
      const next =
        [...room.players.values()]
          .filter((candidate) => candidate.connected)
          .sort((a, b) => a.joinedAt - b.joinedAt)[0] ||
        room.players.values().next().value ||
        null;
      room.hostId = next?.id || null;
      void Promise.resolve(
        this.persistence?.onHostChange?.({ room, hostId: room.hostId }),
      ).catch((err) => this.logger.error("[engine] onHostChange failed", err));
    }

    if (room.phase === "playing" && room.module?.onPlayerLeave) {
      try {
        const previousPhase = room.state?.phase;
        room.module.onPlayerLeave(room, playerId);
        if (room.state?.done) {
          this.finish(room, "player_left");
          return;
        }
        this.arm(room);
        if (previousPhase !== room.state?.phase) {
          this.persistSnapshot(room, "phase");
        }
      } catch (err) {
        this.logger.error("[engine] onPlayerLeave failed", err);
      }
    }

    if (room.players.size === 0) {
      this.destroyRoom(room, reason);
      return;
    }

    this.broadcast(room);
  }

  destroyRoom(room, reason) {
    if (reason === "restore_timeout") this.closedRestores.add(room.id);
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    if (room.restoreTimer) clearTimeout(room.restoreTimer);
    room.restoreTimer = null;
    for (const player of room.players.values()) {
      if (player.graceTimer) clearTimeout(player.graceTimer);
    }
    for (const socketId of room.spectators) {
      const socket = this.connections.get(socketId);
      socket?.emit("room:closed", {
        message: "The room has ended",
      });
    }
    room.spectators.clear();
    this.rooms.delete(room.id);
    if (room.phase !== "results" || !room.endPersisted) {
      void Promise.resolve(
        this.persistence?.onEmpty?.({ room, reason }),
      ).catch((err) => this.logger.error("[engine] onEmpty failed", err));
    }
  }

  async action(socket, payload = {}) {
    const ctx = this.context(socket);
    if (!ctx) throw failure("not_in_room", "Join a room first");
    const { room, player } = ctx;
    const action = String(payload.action || "");
    const data = payload.data || {};

    if (!this.accept(room, player.id, payload.eventId)) return;

    switch (action) {
      case "ready": {
        this.inPhase(room, "lobby", "The game has already started");
        player.isReady = Boolean(data.ready);
        break;
      }
      case "selectGame": {
        this.inPhase(room, "lobby", "The game has already started");
        const game = getGame(String(data.gameId || ""));
        if (!game) throw failure("unknown_game", "That game does not exist");
        if (!contentAllowed(contentForGame(game.id))) {
          throw failure("content_blocked", "That game is not available");
        }
        const mode = String(data.mode || "classic");
        if (!game.modes[mode]) {
          throw failure("unknown_mode", "That mode does not exist");
        }
        room.gameId = game.id;
        room.mode = mode;
        if (game.teams) {
          room.teams = autoBalance(
            [...room.players.keys()],
            game.teams.count,
          );
          room.teamsLocked = false;
        } else {
          room.teams = null;
          room.teamsLocked = false;
        }
        break;
      }
      case "autoBalanceTeams": {
        this.hostOnly(room, player);
        this.inPhase(room, "lobby", "Teams are locked once the game starts");
        const game = getGame(room.gameId);
        if (!game?.teams) throw failure("no_teams", "This game has no teams");
        if (room.teamsLocked) throw failure("teams_locked", "Teams are locked");
        room.teams = autoBalance(
          [...room.players.keys()],
          game.teams.count,
        );
        break;
      }
      case "shuffleTeams": {
        this.hostOnly(room, player);
        this.inPhase(room, "lobby", "Teams are locked once the game starts");
        const game = getGame(room.gameId);
        if (!game?.teams) throw failure("no_teams", "This game has no teams");
        if (room.teamsLocked) throw failure("teams_locked", "Teams are locked");
        room.teams = autoBalance(
          [...room.players.keys()],
          game.teams.count,
        );
        break;
      }
      case "movePlayerTeam": {
        this.hostOnly(room, player);
        this.inPhase(room, "lobby", "Teams are locked once the game starts");
        if (room.teamsLocked) throw failure("teams_locked", "Teams are locked");
        const targetTeam = (room.teams || []).find(
          (team) => team.id === data.teamId,
        );
        if (!targetTeam) throw failure("team_not_found", "Pick a team first");
        const targetPlayer = String(data.playerId || "");
        if (!room.players.has(targetPlayer)) {
          throw failure("player_not_found", "That player has left");
        }
        removeFromTeams(room, targetPlayer);
        targetTeam.playerIds.push(targetPlayer);
        break;
      }
      case "lockTeams": {
        this.hostOnly(room, player);
        this.inPhase(room, "lobby", "Teams are locked once the game starts");
        room.teamsLocked = Boolean(data.locked);
        break;
      }
      case "latencyPong": {
        const sentAt = socket.data.latencyPings?.get(data.id);
        if (sentAt) {
          socket.data.latencyPings.delete(data.id);
          recordLatency(room, player.id, Date.now() - sentAt);
        }
        return;
      }
      case "start": {
        this.hostOnly(room, player);
        this.start(room);
        return;
      }
      case "end": {
        this.hostOnly(room, player);
        this.inPhase(room, "playing", "There is no game to end");
        this.finish(room, "host_ended");
        return;
      }
      case "restart": {
        this.hostOnly(room, player);
        this.inPhase(room, "results", "The game is not finished yet");
        this.resetToLobby(room);
        break;
      }
      case "kick": {
        this.hostOnly(room, player);
        this.inPhase(room, "lobby", "Players cannot be kicked mid-game");
        const targetId = String(data.playerId || "");
        if (targetId === player.id) {
          throw failure("cannot_kick_self", "You cannot kick yourself");
        }
        const target = room.players.get(targetId);
        if (!target) throw failure("player_not_found", "That player has left");
        const targetSocket =
          target.socketId && this.connections.get(target.socketId);
        targetSocket?.emit("room:kicked", {
          message: "The host removed you from the room",
        });
        this.removePlayer(room, targetId, "kicked");
        return;
      }
      case "mute": {
        this.hostOnly(room, player);
        const targetId = String(data.playerId || "");
        if (targetId === player.id) {
          throw failure("cannot_mute_self", "You cannot mute yourself");
        }
        const target = room.players.get(targetId);
        if (!target) throw failure("player_not_found", "That player has left");
        target.muted = data.muted === undefined ? true : Boolean(data.muted);
        this.broadcast(room);
        this.persistSnapshot(room, "moderation");
        return;
      }
      case "report": {
        const targetId = String(data.playerId || "");
        if (targetId === player.id) {
          throw failure("cannot_report_self", "You cannot report yourself");
        }
        const target = room.players.get(targetId);
        if (!target) throw failure("player_not_found", "That player has left");
        const reason = String(data.reason || "other");
        if (!REPORT_REASONS.has(reason)) {
          throw failure("invalid_report_reason", "Pick a valid report reason");
        }
        const reportKey = `${player.id}:${targetId}`;
        if (room.reports.has(reportKey)) {
          throw failure("already_reported", "You already reported that player");
        }
        let saved = false;
        try {
          saved = Boolean(
            await this.persistence?.onReport?.({
              sessionId: room.id,
              groupId: room.groupId,
              reporterUserId: player.userId || null,
              targetUserId: target.userId || null,
              reporterName: player.name,
              targetName: target.name,
              reason,
            }),
          );
        } catch (err) {
          this.logger.error("[engine] onReport failed", err);
        }
        if (!saved) {
          throw failure(
            "report_failed",
            "Your report could not be saved. Please try again.",
          );
        }
        room.reports.add(reportKey);
        this.broadcast(room);
        this.persistSnapshot(room, "moderation");
        return;
      }
      case "requestSync": {
        socket.emit("room:sync", this.view(room, player.id));
        return;
      }
      default:
        throw failure("unknown_action", "Unknown action");
    }

    this.broadcast(room);
  }

  start(room) {
    this.inPhase(room, "lobby", "A game is already running");
    if (!room.gameId) throw failure("select_game", "Select a game first");
    const game = getGame(room.gameId);
    if (!game) throw failure("unknown_game", "That game does not exist");
    if (!contentAllowed(contentForGame(game.id))) {
      throw failure("content_blocked", "That game is not available");
    }
    const mode = room.mode || "classic";
    if (!game.modes[mode]) {
      throw failure("unknown_mode", "That mode does not exist");
    }

    const players = [...room.players.values()];
    if (players.length < game.minPlayers) {
      throw failure(
        "not_enough_players",
        `${game.name} needs at least ${game.minPlayers} players`,
      );
    }
    if (players.length > game.maxPlayers) {
      throw failure(
        "too_many_players",
        `${game.name} allows at most ${game.maxPlayers} players`,
      );
    }

    const offline = players.filter((candidate) => !candidate.connected);
    if (offline.length > 0) {
      throw failure(
        "players_offline",
        `Waiting for ${offline.map((candidate) => candidate.name).join(", ")}`,
      );
    }

    if (game.teams) {
      if (!room.teams?.length) {
        room.teams = autoBalance(
          [...room.players.keys()],
          game.teams.count,
        );
      }
      syncTeams(room, [...room.players.keys()]);
      const teamCheck = validateTeams(room, game.teams);
      if (!teamCheck.ok) throw failure("teams_not_ready", teamCheck.message);
    } else {
      room.teams = null;
    }

    room.phase = "playing";
    room.module = game;
    room.mode = mode;
    room.scores = Object.fromEntries(players.map((player) => [player.id, 0]));
    room.result = null;
    room.endPersisted = false;
    room.state = game.init(room, mode);

    if (!room.state || typeof room.state !== "object") {
      room.state = {};
    }
    if (!Number.isFinite(room.state.endsAt) && !room.state.done) {
      room.state.endsAt = Date.now() + 3_000;
    }

    this.arm(room);
    this.broadcast(room);
    this.persistSnapshot(room, "start");

    void Promise.resolve(
      this.persistence?.onStart?.({
        room,
        gameId: game.id,
        mode,
        sessionId: room.id,
        groupId: room.groupId,
      }),
    ).catch((err) => this.logger.error("[engine] onStart failed", err));

    if (room.state.done) this.finish(room, "completed");
  }

  arm(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.endsAt = null;

    if (room.paused || room.phase !== "playing") return;
    const endsAt = Number(room.state?.endsAt);
    if (!Number.isFinite(endsAt)) return;

    room.endsAt = endsAt;
    const delay = Math.max(TICK_MS, endsAt - Date.now());
    room.timer = setTimeout(() => {
      room.timer = null;
      this.advance(room, "timeout");
    }, delay);
    room.timer.unref?.();
  }

  advance(room, reason) {
    if (room.paused || room.phase !== "playing" || room.advancing) return;
    if (!room.module) return;

    room.advancing = true;
    try {
      const outcome = room.module.onPhaseEnd?.(room, { reason });
      if (outcome === "results" || room.state?.done) {
        this.finish(room, "completed");
        return;
      }
      if (!Number.isFinite(Number(room.state?.endsAt))) {
        room.state = room.state || {};
        room.state.endsAt = Date.now() + 3_000;
      }
      this.arm(room);
      this.broadcast(room);
      this.persistSnapshot(room, "phase");
    } catch (err) {
      this.logger.error("[engine] onPhaseEnd failed", err);
      this.finish(room, "error");
    } finally {
      room.advancing = false;
    }
  }

  finish(room, reason) {
    if (room.phase === "results") return;
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    if (room.restoreTimer) clearTimeout(room.restoreTimer);
    room.restoreTimer = null;
    room.endsAt = null;
    room.paused = false;
    room.pausedRemainingMs = null;
    room.phase = "results";

    const ranking = [...room.players.values()]
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        score: Number(room.scores[player.id] || 0),
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    room.result = {
      reason,
      ranking,
      winnerIds: ranking.length
        ? ranking
            .filter((entry) => entry.score === ranking[0].score)
            .map((entry) => entry.playerId)
        : [],
    };

    this.broadcast(room);
    this.persistSnapshot(room, "results");

    if (!room.endPersisted) {
      room.endPersisted = true;
      void Promise.resolve(
        this.persistence?.onEnd?.({
          room,
          sessionId: room.id,
          groupId: room.groupId,
          gameId: room.gameId,
          mode: room.mode,
          ranking,
          scores: Object.fromEntries(
            ranking.map((entry) => [entry.name, entry.score]),
          ),
          reason,
        }),
      ).catch((err) => this.logger.error("[engine] onEnd failed", err));
    }
  }

  resetToLobby(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    if (room.restoreTimer) clearTimeout(room.restoreTimer);
    room.restoreTimer = null;
    room.endsAt = null;
    room.paused = false;
    room.pausedRemainingMs = null;
    room.phase = "lobby";
    room.state = null;
    room.module = null;
    room.scores = {};
    room.result = null;
    room.endPersisted = false;
    for (const player of room.players.values()) {
      player.isReady = false;
    }
    this.broadcast(room);
    this.persistSnapshot(room, "lobby");

    void Promise.resolve(
      this.persistence?.onLobby?.({ room, sessionId: room.id }),
    ).catch((err) => this.logger.error("[engine] onLobby failed", err));
  }

  gameEvent(socket, payload = {}) {
    const ctx = this.context(socket);
    if (!ctx) throw failure("not_in_room", "Join a room first");
    const { room, player } = ctx;
    this.inPhase(room, "playing", "The game is not running");
    if (!room.module) throw failure("no_game", "No game is running");
    if (player.muted) {
      throw failure("muted", "The host muted you");
    }
    if (!this.accept(room, player.id, payload.eventId)) return;

    const event =
      payload && typeof payload === "object"
        ? { ...payload, playerId: player.id }
        : { playerId: player.id };
    delete event.eventId;

    const previousPhase = room.state?.phase;
    const outcome = room.module.onEvent?.(room, player.id, event);
    if (outcome === "results" || room.state?.done) {
      this.finish(room, "completed");
      return;
    }

    this.arm(room);
    this.broadcast(room);
    if (previousPhase !== room.state?.phase) {
      this.persistSnapshot(room, "phase");
    }
  }

  view(room, viewerId) {
    const viewer = room.players.get(viewerId);
    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => ({
        id: player.id,
        name: player.name,
        avatarUrl: player.avatarUrl,
        isHost: player.id === room.hostId,
        ready: player.isReady,
        muted: Boolean(player.muted),
        connected: player.connected,
        score: Number(room.scores[player.id] || 0),
      }));

    const game =
      room.module && room.phase !== "lobby"
        ? room.module.viewFor(room, viewerId)
        : null;

    return {
      version: room.version,
      sessionId: room.id,
      groupId: room.groupId,
      groupName: room.groupName,
      joinCode: room.joinCode,
      phase: room.phase,
      hostId: room.hostId,
      gameId: room.gameId,
      mode: room.mode,
      endsAt: room.endsAt,
      serverNow: Date.now(),
      players,
      you: viewer
        ? {
            id: viewer.id,
            name: viewer.name,
            isHost: viewer.id === room.hostId,
            ready: viewer.isReady,
            muted: Boolean(viewer.muted),
          }
        : null,
      yourReports: viewer
        ? [...room.reports]
            .filter((key) => key.startsWith(`${viewer.id}:`))
            .map((key) => key.slice(viewer.id.length + 1))
        : [],
      scores: players.map((player) => ({
        playerId: player.id,
        name: player.name,
        score: player.score,
      })),
      ...teamsView(room),
      yourTeamId: room.teams?.find((team) => team.playerIds.includes(viewerId))?.id || null,
      result: room.result ? this.publicResult(room) : null,
      game,
      catalog: this.catalog(),
    };
  }

  publicView(room) {
    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((player) => ({
        id: player.id,
        name: player.name,
        avatarUrl: player.avatarUrl,
        isHost: player.id === room.hostId,
        ready: player.isReady,
        muted: Boolean(player.muted),
        connected: player.connected,
        score: Number(room.scores[player.id] || 0),
      }));

    const game =
      room.module && room.phase !== "lobby"
        ? room.module.publicFor?.(room) || null
        : null;

    return {
      version: room.version,
      sessionId: room.id,
      groupId: room.groupId,
      phase: room.phase,
      hostId: room.hostId,
      gameId: room.gameId,
      mode: room.mode,
      endsAt: room.endsAt,
      serverNow: Date.now(),
      players,
      you: null,
      scores: players.map((player) => ({
        playerId: player.id,
        name: player.name,
        score: player.score,
      })),
      ...teamsView(room),
      result: room.result ? this.publicResult(room) : null,
      game,
      catalog: this.catalog(),
    };
  }

  publicResult(room) {
    if (!room.result) return null;
    return {
      reason: room.result.reason,
      ranking: room.result.ranking.map((entry) => ({
        ...entry,
        isWinner: room.result.winnerIds.includes(entry.playerId),
      })),
    };
  }

  catalog() {
    return listGames().map((game) => {
      const content = contentForGame(game.id);
      return {
        id: game.id,
        name: game.name,
        description: game.description,
        emoji: game.emoji || "🎮",
        accent: game.accent || "grape",
        tag: game.tag || "Party game",
        rating: content.rating,
        nsfw: content.nsfw,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        teams: game.teams || null,
        modes: Object.entries(game.modes).map(([id, config]) => ({
          id,
          label: config.label || id,
          description: config.description || "",
        })),
      };
    });
  }

  broadcast(room) {
    room.version += 1;
    for (const player of room.players.values()) {
      if (!player.socketId) continue;
      const socket = this.connections.get(player.socketId);
      if (socket) socket.emit("room:sync", this.view(room, player.id));
    }
    for (const socketId of room.spectators) {
      const socket = this.connections.get(socketId);
      if (socket) socket.emit("room:sync", this.publicView(room));
    }
  }

  close() {
    for (const room of this.rooms.values()) {
      if (room.timer) clearTimeout(room.timer);
      if (room.restoreTimer) clearTimeout(room.restoreTimer);
      for (const player of room.players.values()) {
        if (player.graceTimer) clearTimeout(player.graceTimer);
      }
    }
    for (const connection of this.connections.values()) {
      if (connection.latencyTimer) clearInterval(connection.latencyTimer);
    }
    this.rooms.clear();
    this.connections.clear();
  }
}
