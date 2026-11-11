"use client";

import { useAuth } from "@/components/AuthProvider";
import { joinOpenLobbyAsGuest } from "@/lib/play";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GuestEntryPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/dashboard");
  }, [isLoaded, isSignedIn, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const lobbyCode = code.trim().toUpperCase();
    if (!name.trim()) {
      setError("Enter the name your friends will see.");
      return;
    }
    if (lobbyCode.length !== 6) {
      setError("Enter the 6-character lobby code.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const lobbyId = await joinOpenLobbyAsGuest(name, lobbyCode);
      router.replace(`/lobby/${lobbyId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not join the lobby",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-12 text-white">
      <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-400">
            No account needed
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">
            Join as a guest
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Enter the 6-character code from the host. You can join a lobby that
            is already open.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Your display name
              </span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                maxLength={30}
                autoFocus
                placeholder="Alex"
                className="neon-input w-full bg-black/40"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Lobby code
              </span>
              <input
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                  setError("");
                }}
                maxLength={6}
                inputMode="text"
                autoComplete="off"
                placeholder="LOREX"
                className="neon-input w-full bg-black/40 text-center font-mono text-xl uppercase tracking-[0.3em]"
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
              {loading ? "Checking the lobby…" : "Enter game →"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
            Guests can play the open lobby but cannot create groups, open a
            lobby, or see group history.
          </p>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => router.push("/sign-in")}
              className="font-semibold text-violet-400 hover:text-violet-300"
            >
              Sign in instead
            </button>
            <span className="text-zinc-700">•</span>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-zinc-400 hover:text-white"
            >
              Back home
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
