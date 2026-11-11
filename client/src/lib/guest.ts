"use client";

import { supabase } from "@/lib/supabase";

/**
 * Create or reuse a Supabase anonymous session. The auth uid is the guest id,
 * so upgrading the account later keeps the same player and lobby history.
 */
export async function ensureGuestSession(displayName: string) {
  const { data: current } = await supabase.auth.getSession();
  if (current.session) {
    if (current.session.user.is_anonymous) {
      await supabase.auth.updateUser({
        data: { display_name: displayName.trim() || "Guest" },
      });
    }
    return current.session;
  }

  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: displayName.trim() || "Guest" } },
  });
  if (error) throw error;
  if (!data.session) throw new Error("Could not create a guest session");
  return data.session;
}

/**
 * Convert the current anonymous user into a permanent account without changing
 * its auth uid. Lobby rows and session history therefore keep the same owner.
 */
export async function upgradeGuestAccount({
  email,
  password,
  displayName,
}: {
  email: string;
  password: string;
  displayName?: string;
}) {
  const { data, error } = await supabase.auth.updateUser({
    email: email.trim(),
    password,
    data: displayName ? { display_name: displayName.trim() } : undefined,
  });
  if (error) throw error;
  return data.user;
}
