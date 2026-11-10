"use client";

import { create } from "zustand";

export type RoomPhase = "lobby" | "playing" | "results";
export type RoomStatus =
  | "idle"
  | "connecting"
  | "joining"
  | "ready"
  | "reconnecting"
  | "error";

export interface RoomPlayer {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  score: number;
}

export interface CatalogMode {
  id: string;
  label: string;
  description: string;
}

export interface CatalogGame {
  id: string;
  name: string;
  description: string;
  emoji: string;
  accent: string;
  minPlayers: number;
  maxPlayers: number;
  modes: CatalogMode[];
}

export interface ScoreEntry {
  playerId: string;
  name: string;
  score: number;
}

export interface RoomResult {
  reason: string;
  ranking: (ScoreEntry & { isWinner: boolean })[];
}

export interface RoomView {
  version: number;
  sessionId: string;
  groupId: string | null;
  phase: RoomPhase;
  hostId: string | null;
  gameId: string | null;
  mode: string | null;
  endsAt: number | null;
  serverNow: number;
  players: RoomPlayer[];
  you: {
    id: string;
    name: string;
    isHost: boolean;
    ready: boolean;
  } | null;
  scores: ScoreEntry[];
  result: RoomResult | null;
  game: Record<string, unknown> | null;
  catalog: CatalogGame[];
}

interface RoomState {
  room: RoomView | null;
  status: RoomStatus;
  error: { code: string; message: string } | null;
  kicked: boolean;
  setRoom: (room: RoomView) => void;
  setStatus: (status: RoomStatus) => void;
  setError: (error: { code: string; message: string } | null) => void;
  setKicked: (kicked: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  status: "idle",
  error: null,
  kicked: false,
  setRoom: (room) => set({ room }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setKicked: (kicked) => set({ kicked }),
  reset: () =>
    set({
      room: null,
      status: "idle",
      error: null,
      kicked: false,
    }),
}));
