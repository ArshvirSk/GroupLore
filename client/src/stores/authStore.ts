"use client";

import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

export type AuthStatus = "loading" | "authed" | "anon" | "none";

export type Profile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  email: string | null;
};

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  status: AuthStatus;
  guestsEnabled: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setGuestsEnabled: (enabled: boolean) => void;
  clear: () => void;
}

function statusFor(session: Session | null): AuthStatus {
  if (!session) return "none";
  return session.user?.is_anonymous ? "anon" : "authed";
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isGuest: false,
  status: "loading",
  guestsEnabled: true,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isGuest: Boolean(session?.user?.is_anonymous),
      status: statusFor(session),
      profile: null,
    }),
  setProfile: (profile) => set({ profile }),
  setGuestsEnabled: (guestsEnabled) => set({ guestsEnabled }),
  clear: () =>
    set({
      session: null,
      user: null,
      profile: null,
      isGuest: false,
      status: "none",
    }),
}));
