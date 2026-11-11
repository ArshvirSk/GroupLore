"use client";

import { api, setAuthTokenGetter } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/stores/userStore";
import type { Session, User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  displayName: string;
  avatarUrl: string | null;
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PROTECTED_PREFIXES = ["/dashboard", "/group"];

function nameFor(user: User | null): string {
  if (!user) return "Player";
  const meta = user.user_metadata || {};
  const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(" ");
  return (
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    fullName ||
    user.email?.split("@")[0] ||
    "Player"
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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const setDbUserId = useUserStore((state) => state.setDbUserId);
  const clearDbUserId = useUserStore((state) => state.clear);
  const syncedFor = useRef<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;

    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed.session?.access_token ?? null;
  }, []);

  useEffect(() => {
    setAuthTokenGetter(getAccessToken);
  }, [getAccessToken]);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoaded(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setIsLoaded(true);
      if (event === "SIGNED_OUT") {
        syncedFor.current = null;
        clearDbUserId();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [clearDbUserId]);

  const user = session?.user ?? null;
  const displayName = useMemo(() => nameFor(user), [user]);
  const avatarUrl = useMemo(() => avatarFor(user), [user]);

  useEffect(() => {
    if (!user) return;
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;

    api
      .syncUser()
      .then((res: { dbUserId?: string }) => {
        if (res.dbUserId) setDbUserId(res.dbUserId);
      })
      .catch((err) => {
        console.error("User sync failed:", err);
        syncedFor.current = null;
      });
  }, [user, setDbUserId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (session) return;
    if (PROTECTED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
      router.replace("/sign-in");
    }
  }, [isLoaded, session, pathname, router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearDbUserId();
    syncedFor.current = null;
    router.replace("/");
  }, [clearDbUserId, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoaded,
      isSignedIn: Boolean(session),
      displayName,
      avatarUrl,
      getAccessToken,
      signOut,
    }),
    [
      user,
      session,
      isLoaded,
      displayName,
      avatarUrl,
      getAccessToken,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
