import { apiJson } from "@/server/api/http";
import { guestsAllowed } from "@/server/lib/guestAccess.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Google button only appears once the provider is configured in Supabase.
 * Asking Supabase directly keeps the UI honest without a stale cache.
 */
async function googleEnabled() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const settings = await res.json();
    return Boolean(settings?.external?.google);
  } catch {
    return false;
  }
}

export async function GET() {
  return apiJson({
    guestsEnabled: guestsAllowed(),
    googleEnabled: await googleEnabled(),
  });
}
