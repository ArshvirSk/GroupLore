"use client";

import { useAuth } from "@/components/AuthProvider";
import { safeNextPath, withNext } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const guestPath = nextPath.startsWith("/join/") ? nextPath : "/guest";
  const { isLoaded, isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace(nextPath);
  }, [isLoaded, isSignedIn, nextPath, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-12 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-400">
          Welcome back
        </p>
        <h1 className="text-3xl font-black uppercase tracking-tighter">
          Sign in to GroupLore
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your groups, games and lore are waiting.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="neon-input w-full bg-black/40"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Password
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="neon-input w-full bg-black/40"
              placeholder="Your password"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-xl bg-violet-600 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            or
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={() => router.push(guestPath)}
          className="min-h-12 w-full rounded-xl border border-white/10 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white"
        >
          Continue as guest →
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-600">
          No account needed to join an open lobby.
        </p>

        <p className="mt-6 text-center text-xs text-zinc-500">
          New here?{" "}
          <button
            type="button"
            onClick={() => router.push(withNext("/sign-up", nextPath))}
            className="font-semibold text-violet-400 hover:text-violet-300"
          >
            Create an account
          </button>
        </p>
      </div>
    </main>
  );
}
