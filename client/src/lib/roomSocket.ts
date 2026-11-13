"use client";

import { io, Socket } from "socket.io-client";

export type RoomAuth = {
  token: string | null;
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
    socket = io({
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
  const auth = await refreshRoomAuth();
  if (!auth?.token) throw new Error("Sign in to join this room");
  if (!current.connected) current.connect();
  return current;
}

export function disconnectRoomSocket() {
  socket?.disconnect();
  socket = null;
}

export function eventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function noteSocketAuthRetry(max = 3) {
  authRetries += 1;
  return authRetries <= max;
}

export function resetSocketAuthRetry() {
  authRetries = 0;
}
