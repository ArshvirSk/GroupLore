"use client";

import { useAuth } from "@/components/AuthProvider";
import FloatingBlobs from "@/components/FloatingBlobs";
import { api } from "@/lib/api";
import { withNext } from "@/lib/authRedirect";
import {
  getInvite,
  groupEntryPath,
  joinOpenLobbyAsGuest,
  type InviteInfo,
} from "@/lib/play";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const inviteCode = String(code || "")
    .trim()
    .toUpperCase();
  const nextPath = `/join/${inviteCode}`;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState("");
  const [guestJoining, setGuestJoining] = useState(false);

  useEffect(() => {
    let active = true;
    getInvite(inviteCode)
      .then((data) => {
        if (active) setInvite(data);
      })
      .catch((err) => {
        if (!active) return;
        setLookupError(
          err instanceof Error ? err.message : "This invite could not be found",
        );
      })
      .finally(() => {
        if (active) setLookupDone(true);
      });

    return () => {
      active = false;
    };
  }, [inviteCode]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !invite || joinError) return;

    let active = true;
    void (async () => {
      try {
        await api.syncUser().catch(() => null);
        const group = await api.joinGroup({ joinCode: inviteCode });
        const destination = await groupEntryPath(group.id);
        if (active) router.replace(destination);
      } catch (err) {
        if (!active) return;
        setJoinError(
          err instanceof Error ? err.message : "Could not join this group",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [invite, inviteCode, isLoaded, isSignedIn, joinError, router]);

  const handleGuest = async () => {
    if (!invite?.lobby || !guestName.trim()) return;
    setGuestJoining(true);
    setGuestError("");
    try {
      const lobbyId = await joinOpenLobbyAsGuest(guestName, inviteCode);
      router.replace(`/lobby/${lobbyId}`);
    } catch (err) {
      setGuestError(
        err instanceof Error ? err.message : "Could not join as a guest",
      );
    } finally {
      setGuestJoining(false);
    }
  };

  const card = (children: React.ReactNode) => (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-12">
      <FloatingBlobs />
      <motion.div
        className="party-card relative z-10 w-full max-w-md p-8"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
      >
        {children}
      </motion.div>
    </main>
  );

  if (!isLoaded || !lookupDone) {
    return card(
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-lavender border-t-grape" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
          Checking your invite…
        </h1>
      </div>,
    );
  }

  if (lookupError) {
    return card(
      <div className="text-center">
        <p className="text-4xl">🙈</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
          That invite didn&apos;t work
        </h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">{lookupError}</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-6 min-h-12 w-full rounded-2xl bg-grape px-5 font-display text-sm font-semibold text-white shadow-soft"
        >
          Go home
        </button>
      </div>,
    );
  }

  if (joinError) {
    return card(
      <div className="text-center">
        <p className="text-4xl">😵</p>
        <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
          Could not join this group
        </h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">{joinError}</p>
        <button
          type="button"
          onClick={() => router.replace("/dashboard")}
          className="mt-6 min-h-12 w-full rounded-2xl bg-grape px-5 font-display text-sm font-semibold text-white shadow-soft"
        >
          Go to dashboard
        </button>
      </div>,
    );
  }

  if (!invite) return null;

  if (isSignedIn) {
    return card(
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-lavender border-t-grape" />
        <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
          Joining {invite.group.name}…
        </h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          We&apos;ll take you to the lobby if one is open.
        </p>
      </div>,
    );
  }

  const guestAvailable = invite.guestsEnabled && Boolean(invite.lobby);

  return card(
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-grape">
        You&apos;re invited
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
        {invite.group.name}
      </h1>
      <p className="mt-2 text-sm font-semibold text-ink-soft">
        {invite.lobby
          ? "A lobby is open now. Choose how you want to join."
          : "No lobby is open yet. Sign in to join the group, or ask the host to open a lobby."}
      </p>

      <section className="mt-6 rounded-2xl border border-ink/10 bg-white/70 p-4">
        <h2 className="font-display text-lg font-semibold text-ink">
          Continue as guest
        </h2>
        {guestAvailable ? (
          <>
            <p className="mt-1 text-xs font-semibold text-ink-soft">
              No account needed. Guests can play this open lobby but cannot see
              group history or open lobbies.
            </p>
            <input
              value={guestName}
              onChange={(event) => {
                setGuestName(event.target.value);
                setGuestError("");
              }}
              maxLength={30}
              placeholder="Your display name"
              className="mt-3 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-grape"
            />
            {guestError && (
              <p className="mt-2 text-xs font-bold text-[#B83232]">
                {guestError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleGuest()}
              disabled={!guestName.trim() || guestJoining}
              className="mt-3 min-h-12 w-full rounded-xl bg-grape px-5 font-display text-sm font-semibold text-white shadow-soft transition enabled:hover:bg-[#7C4DEB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {guestJoining ? "Joining lobby…" : "Continue as guest →"}
            </button>
          </>
        ) : (
          <p className="mt-2 text-xs font-semibold text-ink-soft">
            {!invite.guestsEnabled
              ? "Guest play is disabled on this server."
              : "The host needs to open a lobby before a guest can join."}
          </p>
        )}
      </section>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          or use an account
        </span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <button
        type="button"
        onClick={() =>
          router.push(`/sign-in?next=${encodeURIComponent(nextPath)}`)
        }
        className="min-h-12 w-full rounded-xl border-2 border-grape px-5 font-display text-sm font-semibold text-grape transition hover:bg-lavender/30"
      >
        Sign in to join the group
      </button>
      <button
        type="button"
        onClick={() => router.push(withNext("/sign-up", nextPath))}
        className="mt-2 min-h-11 w-full text-xs font-bold uppercase tracking-wide text-ink-soft underline-offset-4 hover:underline"
      >
        Create an account
      </button>
    </div>,
  );
}
