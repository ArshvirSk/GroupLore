"use client";

import { useAuth } from "@/components/AuthProvider";
import { upgradeGuestAccount } from "@/lib/guest";
import { safeNextPath } from "@/lib/authRedirect";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function UpgradePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { isLoaded, isGuest, displayName } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && !isGuest) router.replace(nextPath);
  }, [isLoaded, isGuest, nextPath, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await upgradeGuestAccount({ email, password, displayName });
      setMessage("Account linked. Your guest id and lobby history are preserved.");
      window.setTimeout(() => router.replace(nextPath), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upgrade account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-12 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-400">
          Save your progress
        </p>
        <h1 className="text-3xl font-black uppercase tracking-tighter">
          Keep your lore
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Add an email and password to this guest account. Your auth id never
          changes, so lobby seats and history stay with you.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="neon-input w-full bg-black/40"
            placeholder="you@example.com"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="neon-input w-full bg-black/40"
            placeholder="At least 6 characters"
          />
          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-xl bg-violet-600 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save my progress →"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push(nextPath)}
          className="mt-4 text-xs font-semibold text-zinc-400 hover:text-white"
        >
          Not now
        </button>
      </div>
    </main>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradePageInner />
    </Suspense>
  );
}
