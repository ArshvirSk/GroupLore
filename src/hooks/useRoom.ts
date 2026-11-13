"use client";

import { useAuth } from "@/components/AuthProvider";
import {
  connectRoomSocket,
  eventId,
  getRoomSocket,
  noteSocketAuthRetry,
  refreshRoomAuth,
  resetSocketAuthRetry,
} from "@/lib/roomSocket";
import { useRoomStore } from "@/stores/roomStore";
import { useCallback, useEffect } from "react";

function reconnectKey(sessionId: string) {
  return `grouplore:room:${sessionId}:reconnect`;
}

function readReconnectToken(sessionId: string): string | null {
  try {
    return localStorage.getItem(reconnectKey(sessionId));
  } catch {
    return null;
  }
}

/**
 * Single room connection hook. The socket credential is always the current
 * Supabase access token; there is no guest-token fallback.
 */
export function useRoom(sessionId: string) {
  const { isLoaded, isSignedIn, getAccessToken } = useAuth();

  const room = useRoomStore((state) => state.room);
  const status = useRoomStore((state) => state.status);
  const error = useRoomStore((state) => state.error);
  const kicked = useRoomStore((state) => state.kicked);
  const setRoom = useRoomStore((state) => state.setRoom);
  const setStatus = useRoomStore((state) => state.setStatus);
  const setError = useRoomStore((state) => state.setError);
  const setKicked = useRoomStore((state) => state.setKicked);
  const reset = useRoomStore((state) => state.reset);

  useEffect(() => {
    if (!sessionId || !isLoaded) return;
    if (!isSignedIn) {
      setStatus("error");
      setError({ code: "unauthorized", message: "Sign in to join this room" });
      return;
    }

    let active = true;
    let joinedSocketId: string | null = null;

    const socket = getRoomSocket();

    const join = () => {
      if (!active || socket.id === joinedSocketId) return;
      joinedSocketId = socket.id || null;
      setStatus("joining");
      socket.emit("room:join", {
        sessionId,
        reconnectToken: readReconnectToken(sessionId),
      });
    };

    const onConnect = () => {
      resetSocketAuthRetry();
      join();
    };

    const onConnectError = async (err: Error & { data?: { code?: string } }) => {
      if (err.data?.code === "unauthorized" && noteSocketAuthRetry()) {
        setStatus("connecting");
        await refreshRoomAuth();
        setTimeout(() => {
          if (active) socket.connect();
        }, 300);
        return;
      }
      if (!active) return;
      setStatus("error");
      setError({
        code: err.data?.code || "connection_failed",
        message:
          err.data?.code === "guests_disabled"
            ? "Guest play is disabled. Sign in with an account."
            : err.data?.code === "unauthorized"
              ? "Sign in to join this room"
              : "Could not connect to the game server",
      });
    };

    const onJoined = (payload: { reconnectToken: string }) => {
      joinedSocketId = socket.id || null;
      setStatus("ready");
      try {
        localStorage.setItem(reconnectKey(sessionId), payload.reconnectToken);
      } catch {
        // Private mode can block storage; the seat still works this tab.
      }
    };

    const onSync = (view: Parameters<typeof setRoom>[0]) => {
      if (!active) return;
      joinedSocketId = socket.id || null;
      setRoom(view);
      setStatus("ready");
    };

    const onError = (payload: { code: string; message: string }) => {
      if (!active) return;
      if (payload.code === "session_replaced") setKicked(true);
      setError(payload);
    };

    const onKicked = (payload: { message?: string }) => {
      if (!active) return;
      setKicked(true);
      setError({
        code: "kicked",
        message: payload?.message || "You were removed from the room",
      });
    };

    const onDisconnect = () => {
      if (active) setStatus("reconnecting");
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("room:joined", onJoined);
    socket.on("room:sync", onSync);
    socket.on("room:error", onError);
    socket.on("room:kicked", onKicked);
    socket.on("disconnect", onDisconnect);

    // Keep the handshake token fresh for long matches. AuthProvider owns the
    // token-refresh logic; this only copies the fresh token onto the socket.
    const tokenTimer = setInterval(async () => {
      if (!active) return;
      const token = await getAccessToken();
      if (token) socket.auth = { ...socket.auth, token };
    }, 30_000);

    void connectRoomSocket()
      .then(() => {
        if (active && socket.connected) join();
      })
      .catch((err) => {
        if (!active) return;
        setStatus("error");
        setError({
          code: "connection_failed",
          message: err instanceof Error ? err.message : "Could not connect",
        });
      });

    return () => {
      active = false;
      clearInterval(tokenTimer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("room:joined", onJoined);
      socket.off("room:sync", onSync);
      socket.off("room:error", onError);
      socket.off("room:kicked", onKicked);
      socket.off("disconnect", onDisconnect);
    };
  }, [
    sessionId,
    isLoaded,
    isSignedIn,
    getAccessToken,
    setRoom,
    setStatus,
    setError,
    setKicked,
  ]);

  const act = useCallback((action: string, data: Record<string, unknown> = {}) => {
    getRoomSocket().emit("room:action", {
      action,
      data,
      eventId: eventId(),
    });
  }, []);

  const send = useCallback((type: string, data: Record<string, unknown> = {}) => {
    getRoomSocket().emit("game:event", {
      type,
      ...data,
      eventId: eventId(),
    });
  }, []);

  const leave = useCallback(() => {
    getRoomSocket().emit("room:leave");
    try {
      localStorage.removeItem(reconnectKey(sessionId));
    } catch {
      // ignore storage failures
    }
    reset();
  }, [sessionId, reset]);

  return {
    room: room?.sessionId === sessionId ? room : null,
    status,
    error,
    kicked,
    act,
    send,
    leave,
    clearError: useCallback(() => setError(null), [setError]),
  };
}
