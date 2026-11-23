"use client";

import { safeNextPath } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabase";

/**
 * Send the player to Google. Supabase handles the callback at
 * /auth/v1/callback, then returns to the sign-in page with a session in the
 * URL; that page already forwards signed-in players to their destination.
 */
export async function signInWithGoogle(next: string) {
  const redirectTo = `${window.location.origin}/sign-in?next=${encodeURIComponent(
    safeNextPath(next),
  )}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}
