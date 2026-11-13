"use client";

import { useAuth } from "@/components/AuthProvider";
import type { RoomStatus, RoomView } from "@/stores/roomStore";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

/**
 * The TV is a spectator, not a player. It uses the signed-in Supabase token and
 * never takes a seat. The viewer must already be a member of the room.
 */
export function useTvRoom(sessionId: string) {
  const { isLoaded, isSignedIn, getAccessToken } = useAuth();

  const [room, setRoom] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [error, setError] = useState<{ code: string; message: string } | null>(
    null,
  );
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!sessionId || !isLoaded) return;
    if (!isSignedIn) {
      const timer = setTimeout(() => {
        setStatus("error");
        setError({ code: "unauthorized", message: "Sign in to watch this room" });
      }, 0);
      return () => clearTimeout(timer);
    }

    const socket = io({
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 10000,
    });

    const spectate = () => {
      setStatus("joining");
      socket.emit("room:spectate", { sessionId });
    };

    socket.on("connect", spectate);
    socket.on("room:spectate-joined", () => setStatus("ready"));
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
    socket.on("disconnect", () => setStatus("reconnecting"));
    socket.on("connect_error", () => {
      setStatus("error");
      setError({
        code: "connection_failed",
        message: "Could not connect to the game server",
      });
    });

    void getAccessToken()
      .then((token) => {
        if (!token) throw new Error("Sign in to watch this room");
        socket.auth = { token };
        socket.connect();
      })
      .catch((err) => {
        setStatus("error");
        setError({
          code: "connection_failed",
          message: err instanceof Error ? err.message : "Could not authenticate",
        });
      });

    const tokenTimer = setInterval(async () => {
      const token = await getAccessToken();
      if (token) socket.auth = { ...socket.auth, token };
    }, 30_000);

    return () => {
      clearInterval(tokenTimer);
      socket.emit("room:leave");
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [sessionId, isLoaded, isSignedIn, getAccessToken]);

  return { room, status, error, closed };
}
