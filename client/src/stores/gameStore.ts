"use client";

import { create } from "zustand";

export interface Player {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  isReady: boolean;
  isHost: boolean;
}

interface GameState {
  // Lobby
  sessionId: string | null;
  players: Player[];
  hostId: string | null;
  gameType: string | null;
  isInLobby: boolean;

  // Game
  isInGame: boolean;
  currentRound: number;
  totalRounds: number;
  prompt: any;
  phase: string | null;
  votes: number;
  totalPlayers: number;

  // Results
  results: any;
  scores: Record<string, number>;

  // Actions
  setSessionId: (id: string) => void;
  setPlayers: (players: Player[]) => void;
  setHostId: (id: string) => void;
  setGameType: (type: string | null) => void;
  setLobby: (isInLobby: boolean) => void;
  setInGame: (isInGame: boolean) => void;
  setRound: (round: number, totalRounds: number) => void;
  setPrompt: (prompt: any) => void;
  setPhase: (phase: string | null) => void;
  setVoteCount: (votes: number, totalPlayers: number) => void;
  setResults: (results: any) => void;
  setScores: (scores: Record<string, number>) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  players: [],
  hostId: null,
  gameType: null,
  isInLobby: false,
  isInGame: false,
  currentRound: 0,
  totalRounds: 0,
  prompt: null,
  phase: null,
  votes: 0,
  totalPlayers: 0,
  results: null,
  scores: {},
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setPlayers: (players) => set({ players }),
  setHostId: (id) => set({ hostId: id }),
  setGameType: (type) => set({ gameType: type }),
  setLobby: (isInLobby) => set({ isInLobby }),
  setInGame: (isInGame) => set({ isInGame }),
  setRound: (round, totalRounds) => set({ currentRound: round, totalRounds }),
  setPrompt: (prompt) => set({ prompt }),
  setPhase: (phase) => set({ phase }),
  setVoteCount: (votes, totalPlayers) => set({ votes, totalPlayers }),
  setResults: (results) => set({ results }),
  setScores: (scores) => set({ scores }),
  reset: () => set(initialState),
}));
