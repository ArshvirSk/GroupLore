"use client";

import { useAuth } from "@/components/AuthProvider";
import FloatingBlobs from "@/components/FloatingBlobs";
import { api } from "@/lib/api";
import { groupEntryPath } from "@/lib/play";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const inviteCode = String(code || "").trim().toUpperCase();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(
        `/sign-in?next=${encodeURIComponent(`/join/${inviteCode}`)}`,
      );
      return;
    }

    let active = true;

    void (async () => {
      try {
        await api.syncUser().catch(() => null);
        const group = await api.joinGroup({ joinCode: inviteCode });
        const destination = await groupEntryPath(group.id);
        if (active) router.replace(destination);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "This invite could not be used",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [inviteCode, isLoaded, isSignedIn, router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-12">
      <FloatingBlobs />
      <motion.div
        className="party-card relative z-10 w-full max-w-md p-8 text-center"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        {error ? (
          <>
            <p className="text-4xl">🙈</p>
            <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
              That invite didn&apos;t work
            </h1>
            <p className="mt-2 text-sm font-semibold text-ink-soft">{error}</p>
            <div className="mt-6 grid gap-2">
              <button
                type="button"
                onClick={() => router.replace("/dashboard")}
                className="min-h-12 rounded-2xl bg-grape px-5 font-display text-sm font-semibold text-white shadow-soft"
              >
                Go to dashboard
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-11 rounded-2xl px-5 text-xs font-bold uppercase tracking-wide text-ink-soft underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-lavender border-t-grape" />
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
              Joining the group…
            </h1>
            <p className="mt-2 text-sm font-semibold text-ink-soft">
              Invite {inviteCode || "code"} is being checked. We&apos;ll take you
              to the lobby if one is open.
            </p>
          </>
        )}
      </motion.div>
    </main>
  );
}
