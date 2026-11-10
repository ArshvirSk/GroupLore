"use client";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";
const STORAGE_KEY = "grouplore:guest-identity";

type GuestIdentity = {
  guestId: string;
  name: string;
  guestToken: string;
};

function readStored(): GuestIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestIdentity;
    if (!parsed?.guestToken || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Guests use a server-signed identity so the socket layer never trusts a
 * client-supplied id. The token lives in localStorage so a refresh keeps the
 * same guest seat.
 */
export async function getGuestIdentity(name = "Guest"): Promise<GuestIdentity> {
  const stored = readStored();
  if (stored) return stored;

  const res = await fetch(`${SERVER_URL}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    throw new Error("Guest play is not available");
  }

  const data = (await res.json()) as GuestIdentity;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}
