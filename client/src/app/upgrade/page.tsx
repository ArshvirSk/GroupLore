"use client";

import AuthShell from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Input } from "@/components/ui";
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
    <AuthShell
      eyebrow="Save your progress"
      title="Keep your lore"
      description="Add an email and password to this guest account. Your id and lobby history stay with you."
      footer={
        <button type="button" onClick={() => router.push(nextPath)} className="min-h-11 font-medium text-muted hover:text-ink">
          Not now
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
        {error ? <p role="alert" className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
        {message ? <p className="rounded-[12px] bg-success/10 px-3 py-2 text-sm font-medium text-success">{message}</p> : null}
        <Button type="submit" className="w-full" loading={loading}>Save my progress</Button>
      </form>
    </AuthShell>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradePageInner />
    </Suspense>
  );
}
