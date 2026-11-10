"use client";

import { io, Socket } from "socket.io-client";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

export type RoomAuth = {
  token?: string | null;
  guestToken?: string | null;
  displayName?: string;
  avatarUrl?: string | null;
};

let socket: Socket | null = null;
let authFactory: (() => Promise<RoomAuth>) | null = null;
let authRetries = 0;

export function setRoomAuthFactory(factory: () => Promise<RoomAuth>) {
  authFactory = factory;
}

export function getRoomSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 10000,
    });
  }
  return socket;
}

export async function refreshRoomAuth(): Promise<RoomAuth | null> {
  if (!authFactory) return null;
  const auth = await authFactory();
  const current = getRoomSocket();
  current.auth = auth;
  return auth;
}

export async function connectRoomSocket(): Promise<Socket> {
  const current = getRoomSocket();
  await refreshRoomAuth();
  if (!current.connected) current.connect();
  return current;
}

export function disconnectRoomSocket() {
  socket?.disconnect();
  socket = null;
}

/**
 * Event ids make every socket action idempotent on the server. A retry or a
 * double click with the same id is ignored.
 */
export function eventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function noteSocketAuthRetry(max = 3) {
  authRetries += 1;
  if (authRetries > max) return false;
  return true;
}

export function resetSocketAuthRetry() {
  authRetries = 0;
}
