"use client";

import AuthShell from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Input } from "@/components/ui";
import { safeNextPath, withNext } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const guestPath = nextPath.startsWith("/join/") ? nextPath : "/guest";
  const { isLoaded, isSignedIn, isGuest } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && !isGuest) router.replace(nextPath);
  }, [isLoaded, isSignedIn, isGuest, nextPath, router]);

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
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to GroupLore"
      description="Your groups, games and lore are waiting."
      footer={
        <>
          New here?{" "}
          <button
            type="button"
            onClick={() => router.push(withNext("/sign-up", nextPath))}
            className="min-h-11 font-medium text-primary hover:underline"
          >
            Create an account
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
        {error ? <p role="alert" className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
      </form>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="secondary" className="w-full" onClick={() => router.push(guestPath)}>
        Continue as guest
      </Button>
      <p className="mt-2 text-center text-xs text-muted">No account needed to join an open lobby.</p>
    </AuthShell>
  );
}
