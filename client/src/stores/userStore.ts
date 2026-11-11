"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  // App users UUID — resolved from the Supabase Auth user on first API call
  dbUserId: string | null;
  setDbUserId: (id: string) => void;
  clear: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      dbUserId: null,
      setDbUserId: (id) => set({ dbUserId: id }),
      clear: () => set({ dbUserId: null }),
    }),
    {
      name: "grouplore-user",
    },
  ),
);
