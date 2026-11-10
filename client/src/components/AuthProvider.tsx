"use client";

import { api, setAuthTokenGetter } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/**
 * Initializes Clerk auth token on the API layer and syncs
 * the Clerk user to Supabase (creates/finds the DB user).
 * Place this inside any layout that needs authenticated API calls.
 */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const { dbUserId, setDbUserId } = useUserStore();
  const synced = useRef(false);

  // Wire Clerk token into every API call
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  // Sync Clerk user → Supabase users table (once per session)
  useEffect(() => {
    if (!isSignedIn || !user || synced.current) return;

    synced.current = true;
    api
      .syncUser()
      .then((res) => {
        if (res.dbUserId) setDbUserId(res.dbUserId);
      })
      .catch((err) => {
        console.error("User sync failed:", err);
        synced.current = false; // retry on next render
      });
  }, [isSignedIn, user]);

  return <>{children}</>;
}
