"use client";

import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/dashboard");
  }, [isLoaded, isSignedIn, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() || email.split("@")[0] },
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        router.replace("/dashboard");
        return;
      }

      setMessage("Account created. Sign in to continue.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] px-4 py-12 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-violet-400">
          Start the chaos
        </p>
        <h1 className="text-3xl font-black uppercase tracking-tighter">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Build a crew, collect lore, and play with your people.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Display name
            </span>
            <input
              type="text"
              required
              maxLength={40}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="neon-input w-full bg-black/40"
              placeholder="What should we call you?"
            />
          </label>
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
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="neon-input w-full bg-black/40"
              placeholder="At least 6 characters"
            />
          </label>

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
            {loading ? "Creating account…" : "Create account →"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/sign-in")}
            className="font-semibold text-violet-400 hover:text-violet-300"
          >
            Sign in
          </button>
        </p>
      </div>
    </main>
  );
}
