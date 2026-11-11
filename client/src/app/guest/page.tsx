"use client";

import AuthShell from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, CodeInput, Input } from "@/components/ui";
import { ensureGuestSession } from "@/lib/guest";
import { joinLobby } from "@/lib/play";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GuestEntryPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, isGuest, guestsEnabled } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoaded && isSignedIn && !isGuest) router.replace("/dashboard");
  }, [isLoaded, isSignedIn, isGuest, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter the name your friends will see.");
      return;
    }
    if (code.length !== 6) {
      setError("Enter the six-character lobby code.");
      return;
    }
    if (!guestsEnabled) {
      setError("Guest play is disabled on this server.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await ensureGuestSession(name);
      const lobby = await joinLobby(code);
      router.replace(`/lobby/${lobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the lobby");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="No account needed"
      title="Join as a guest"
      description="Enter the code from your host. Guests join this lobby only, never the group."
      footer={
        <>
          Prefer an account?{" "}
          <button type="button" onClick={() => router.push("/sign-in")} className="min-h-11 font-medium text-primary hover:underline">
            Sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Display name" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} maxLength={30} autoFocus placeholder="Alex" />
        <CodeInput value={code} onChange={(value) => { setCode(value); setError(""); }} label="Lobby code" onEnter={() => void handleSubmit(new Event("submit") as unknown as React.FormEvent)} />
        {!guestsEnabled ? <p className="rounded-[12px] bg-warning/10 px-3 py-2 text-sm font-medium text-warning">Guest play is disabled. Sign in to play.</p> : null}
        {error ? <p role="alert" className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" loading={loading} disabled={!guestsEnabled}>Enter lobby</Button>
      </form>
      <p className="mt-4 text-center text-xs leading-relaxed text-muted">You can upgrade to an account later without losing this lobby seat.</p>
    </AuthShell>
  );
}
