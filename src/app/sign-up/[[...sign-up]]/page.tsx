"use client";

import AuthShell from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Input } from "@/components/ui";
import { safeNextPath, withNext } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const { isLoaded, isSignedIn, isGuest } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoaded && isSignedIn && !isGuest) router.replace(nextPath);
  }, [isLoaded, isSignedIn, isGuest, nextPath, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() || email.split("@")[0] } },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        router.replace(nextPath);
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
    <AuthShell
      eyebrow="Join GroupLore"
      title="Create your account"
      description="Build a crew, collect lore, and play with your people."
      footer={
        <>
          Already have an account?{" "}
          <button type="button" onClick={() => router.push(withNext("/sign-in", nextPath))} className="min-h-11 font-medium text-primary hover:underline">
            Sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Display name" type="text" required maxLength={40} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" />
        <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
        {error ? <p role="alert" className="rounded-[12px] bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p> : null}
        {message ? <p className="rounded-[12px] bg-success/10 px-3 py-2 text-sm font-medium text-success">{message}</p> : null}
        <Button type="submit" className="w-full" loading={loading}>Create account</Button>
      </form>
    </AuthShell>
  );
}
