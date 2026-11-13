"use client";

import AuthShell from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Input } from "@/components/ui";
import { withNext } from "@/lib/authRedirect";
import { getInvite, joinLobby, joinLobbyAsGuest, type InviteInfo } from "@/lib/play";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const inviteCode = String(code || "").trim().toUpperCase();
  const nextPath = `/join/${inviteCode}`;
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestJoining, setGuestJoining] = useState(false);

  useEffect(() => {
    let active = true;
    getInvite(inviteCode)
      .then((data) => active && setInvite(data))
      .catch((err) => {
        if (active) setLookupError(err instanceof Error ? err.message : "This invite could not be found");
      })
      .finally(() => active && setLookupDone(true));
    return () => {
      active = false;
    };
  }, [inviteCode]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !invite || joinError) return;
    let active = true;
    void joinLobby(inviteCode)
      .then((lobby) => {
        if (active) router.replace(`/lobby/${lobby.code}`);
      })
      .catch((err) => {
        if (active) setJoinError(err instanceof Error ? err.message : "Could not join");
      });
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, invite, inviteCode, joinError, router]);

  const handleGuest = async () => {
    if (!invite?.lobby || !guestName.trim()) return;
    setGuestJoining(true);
    setJoinError("");
    try {
      const lobby = await joinLobbyAsGuest(guestName, inviteCode);
      router.replace(`/lobby/${lobby.code}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join as a guest");
    } finally {
      setGuestJoining(false);
    }
  };

  if (!isLoaded || !lookupDone) {
    return (
      <AuthShell eyebrow="Invite" title="Checking your invite" description="This will only take a moment.">
        <div className="flex justify-center py-8">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      </AuthShell>
    );
  }

  if (lookupError || !invite) {
    return (
      <AuthShell eyebrow="Invite" title="That invite didn’t work" description={lookupError || "Ask the host for a fresh link."}>
        <Button className="w-full" onClick={() => router.replace("/")}>Go home</Button>
      </AuthShell>
    );
  }

  if (isSignedIn) {
    return (
      <AuthShell eyebrow="Joining" title={invite.group?.name || "Quick play room"} description="Taking you to the lobby now.">
        <div className="flex justify-center py-8">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
        {joinError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{joinError}</p> : null}
      </AuthShell>
    );
  }

  const guestAvailable = invite.guestsEnabled && invite.lobby.status === "open";

  return (
    <AuthShell
      eyebrow="You’re invited"
      title={invite.group?.name || "Quick play room"}
      description={invite.lobby.status === "open" ? "A lobby is open now. Choose how you want to join." : "This game has already started. Sign in to see the room."}
      footer={
        <>
          Have an account?{" "}
          <button type="button" onClick={() => router.push(`/sign-in?next=${encodeURIComponent(nextPath)}`)} className="min-h-11 font-medium text-primary hover:underline">
            Sign in to join
          </button>
        </>
      }
    >
      <Card className="p-4">
        <h2 className="font-display text-lg font-semibold">Continue as guest</h2>
        {guestAvailable ? (
          <div className="mt-3 space-y-3">
            <Input label="Display name" value={guestName} onChange={(event) => setGuestName(event.target.value)} maxLength={30} placeholder="Your display name" />
            {joinError ? <p role="alert" className="text-sm font-medium text-danger">{joinError}</p> : null}
            <Button className="w-full" disabled={!guestName.trim()} loading={guestJoining} onClick={() => void handleGuest()}>
              Continue as guest
            </Button>
            <p className="text-xs leading-relaxed text-muted">Guests join this lobby only, never the group.</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{!invite.guestsEnabled ? "Guest play is disabled on this server." : "That room is no longer open to new players."}</p>
        )}
      </Card>
      <Button variant="secondary" className="mt-3 w-full" onClick={() => router.push(withNext("/sign-up", nextPath))}>
        Create an account
      </Button>
    </AuthShell>
  );
}
