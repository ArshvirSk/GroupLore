"use client";

import { getGuestIdentity } from "@/lib/guest";
import {
  connectRoomSocket,
  eventId,
  getRoomSocket,
  noteSocketAuthRetry,
  refreshRoomAuth,
  resetSocketAuthRetry,
  setRoomAuthFactory,
} from "@/lib/roomSocket";
import { useRoomStore } from "@/stores/roomStore";
import { useAuth, useUser } from "@clerk/nextjs";
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

function displayNameFor(
  user: ReturnType<typeof useUser>["user"],
): string {
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Guest"
  );
}

/**
 * Single room connection hook.
 *
 * The socket is app-wide and survives lobby -> game navigation. Unmounting a
 * page only detaches listeners; it never leaves the room or disconnects. The
 * only ways out are the explicit leave action, a kick, or the server's
 * disconnect grace period.
 */
export function useRoom(sessionId: string) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const displayName = displayNameFor(user);

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
    let active = true;
    let joinedSocketId: string | null = null;

    setRoomAuthFactory(async () => {
      if (isSignedIn) {
        const token = await getToken({ skipCache: true });
        if (token) {
          return {
            token,
            displayName,
            avatarUrl: user?.imageUrl || null,
          };
        }
      }
      const guest = await getGuestIdentity(displayName);
      return { guestToken: guest.guestToken, displayName: guest.name };
    });

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
      if (active) {
        setStatus("error");
        setError({
          code: err.data?.code || "connection_failed",
          message:
            err.data?.code === "unauthorized"
              ? "Sign in to join this room"
              : "Could not connect to the game server",
        });
      }
    };

    const onJoined = (payload: { reconnectToken: string }) => {
      joinedSocketId = socket.id || null;
      setStatus("ready");
      try {
        localStorage.setItem(reconnectKey(sessionId), payload.reconnectToken);
      } catch {
        // Storage can be unavailable in private mode; reconnect still works
        // while the tab stays open.
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
      if (payload.code === "session_replaced") {
        setKicked(true);
      }
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
      if (!active) return;
      setStatus("reconnecting");
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("room:joined", onJoined);
    socket.on("room:sync", onSync);
    socket.on("room:error", onError);
    socket.on("room:kicked", onKicked);
    socket.on("disconnect", onDisconnect);

    // Clerk session tokens are short lived. Keep the handshake credential fresh
    // so an automatic socket reconnect does not fail after a long match.
    const tokenTimer = setInterval(async () => {
      if (!active || !isSignedIn) return;
      const token = await getToken();
      if (token) socket.auth = { ...socket.auth, token, displayName };
    }, 30_000);

    void connectRoomSocket()
      .then(() => {
        if (active && socket.connected) join();
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
        setError({
          code: "connection_failed",
          message: "Could not connect to the game server",
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
    displayName,
    getToken,
    user?.imageUrl,
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
