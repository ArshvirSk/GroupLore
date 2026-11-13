"use client";

import { api, setAuthTokenGetter } from "@/lib/api";
import { setRoomAuthFactory } from "@/lib/roomSocket";
import { supabase } from "@/lib/supabase";
import { useAuthStore, type AuthStatus } from "@/stores/authStore";
import type { Session, User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  isGuest: boolean;
  status: AuthStatus;
  displayName: string;
  avatarUrl: string | null;
  guestsEnabled: boolean;
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PROTECTED_PREFIXES = ["/dashboard", "/group", "/games", "/leaderboard", "/activity"];

function nameFor(user: User | null): string {
  if (!user) return "Player";
  const meta = user.user_metadata || {};
  const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(" ");
  return (
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    fullName ||
    user.email?.split("@")[0] ||
    (user.is_anonymous ? "Guest" : "Player")
  );
}

function avatarFor(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isGuest = useAuthStore((state) => state.isGuest);
  const status = useAuthStore((state) => state.status);
  const guestsEnabled = useAuthStore((state) => state.guestsEnabled);
  const setSession = useAuthStore((state) => state.setSession);
  const setProfile = useAuthStore((state) => state.setProfile);
  const setGuestsEnabled = useAuthStore((state) => state.setGuestsEnabled);
  const clear = useAuthStore((state) => state.clear);
  const router = useRouter();
  const pathname = usePathname();

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const current = data.session;
    if (current?.access_token) {
      const expiresAt = (current.expires_at || 0) * 1000;
      if (expiresAt > Date.now() + 30_000) return current.access_token;
    }
    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed.session?.access_token ?? current?.access_token ?? null;
  }, []);

  useEffect(() => {
    setAuthTokenGetter(getAccessToken);
    setRoomAuthFactory(async () => {
      const token = await getAccessToken();
      return {
        token,
        displayName: profile?.displayName || nameFor(user),
        avatarUrl: profile?.avatarUrl || avatarFor(user),
      };
    });
  }, [getAccessToken, profile?.displayName, profile?.avatarUrl, user]);

  useEffect(() => {
    api
      .getAuthConfig()
      .then((config) => setGuestsEnabled(Boolean(config.guestsEnabled)))
      .catch(() => {
        // Keep the local default; the server still enforces the policy.
      });
  }, [setGuestsEnabled]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setSession]);

  const displayName = profile?.displayName || nameFor(user);
  const avatarUrl = profile?.avatarUrl || avatarFor(user);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let active = true;
    api
      .syncUser()
      .then((next: { id: string; displayName: string; avatarUrl: string | null; isGuest: boolean; email: string | null }) => {
        if (active) setProfile(next);
      })
      .catch(() => {
        // Session still works; the next API request will retry the profile row.
      });
    return () => {
      active = false;
    };
  }, [session?.user, setProfile]);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "none") {
      if (PROTECTED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
        router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/")}`);
      }
      return;
    }
    if (status === "anon") {
      if (PROTECTED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
        router.replace("/guest");
      }
    }
  }, [status, pathname, router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clear();
    router.replace("/");
  }, [clear, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoaded: status !== "loading",
      isSignedIn: Boolean(session),
      isGuest,
      status,
      displayName,
      avatarUrl,
      guestsEnabled,
      getAccessToken,
      signOut,
    }),
    [
      user,
      session,
      status,
      isGuest,
      displayName,
      avatarUrl,
      guestsEnabled,
      getAccessToken,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
