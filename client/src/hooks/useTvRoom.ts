"use client";

import { getGuestIdentity } from "@/lib/guest";
import type { RoomStatus, RoomView } from "@/stores/roomStore";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

function displayNameFor(user: ReturnType<typeof useUser>["user"]): string {
  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Guest"
  );
}

/**
 * The TV is a spectator, not a player. It uses its own socket so opening the
 * display never takes a seat, affects readiness, or receives private views.
 */
export function useTvRoom(sessionId: string) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const displayName = displayNameFor(user);

  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!sessionId || !isLoaded) return;

    const socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 10000,
    });

    const auth = async () => {
      if (isSignedIn) {
        const token = await getToken({ skipCache: true });
        if (token) return { token, displayName };
      }
      const guest = await getGuestIdentity(displayName);
      return { guestToken: guest.guestToken, displayName: guest.name };
    };

    const spectate = () => {
      setStatus("joining");
      socket.emit("room:spectate", { sessionId });
    };

    socket.on("connect", spectate);
    socket.on("room:spectate-joined", () => {
      setStatus("ready");
    });
    socket.on("room:sync", (view: RoomView) => {
      setRoom(view);
      setClosed(false);
      setStatus("ready");
    });
    socket.on("room:error", (payload: { code: string; message: string }) => {
      setError(payload);
      setStatus("error");
    });
    socket.on("room:closed", () => {
      setRoom(null);
      setClosed(true);
      setStatus("error");
      setError({ code: "room_closed", message: "The room has ended" });
    });
    socket.on("disconnect", () => {
      setStatus("reconnecting");
    });
    socket.on("connect_error", () => {
      setStatus("error");
      setError({
        code: "connection_failed",
        message: "Could not connect to the game server",
      });
    });

    void auth()
      .then((credentials) => {
        socket.auth = credentials;
        socket.connect();
      })
      .catch(() => {
        setStatus("error");
        setError({
          code: "connection_failed",
          message: "Could not authenticate the TV",
        });
      });

    const tokenTimer = setInterval(async () => {
      if (!isSignedIn) return;
      const token = await getToken();
      if (token) socket.auth = { ...socket.auth, token, displayName };
    }, 30_000);

    return () => {
      clearInterval(tokenTimer);
      socket.emit("room:leave");
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [
    sessionId,
    isLoaded,
    isSignedIn,
    displayName,
    getToken,
    user?.imageUrl,
  ]);

  return { room, status, error, closed };
}
