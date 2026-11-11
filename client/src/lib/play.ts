import { api, type Lobby } from "@/lib/api";
import { ensureGuestSession } from "@/lib/guest";

export type InviteInfo = {
  group: { id: string; name: string } | null;
  lobby: {
    id: string;
    code: string;
    status: "open" | "in_game" | "closed";
    group_id: string | null;
  };
  guestsEnabled: boolean;
};

export async function getInvite(code: string): Promise<InviteInfo> {
  return api.getInvite(code) as Promise<InviteInfo>;
}

export function lobbyPath(lobby: Pick<Lobby, "code">) {
  return `/lobby/${lobby.code}`;
}

export async function joinLobby(code: string): Promise<Lobby> {
  return api.joinLobby(code) as Promise<Lobby>;
}

/** Creates an anonymous Supabase session and joins only the lobby. */
export async function joinLobbyAsGuest(
  name: string,
  code: string,
): Promise<Lobby> {
  await ensureGuestSession(name);
  return joinLobby(code);
}

/** Returns the existing open lobby for a group or creates one. */
export async function ensureLobby(groupId: string): Promise<Lobby> {
  return api.openGroupLobby(groupId) as Promise<Lobby>;
}

export async function groupEntryPath(groupId: string) {
  try {
    const group = await api.getGroup(groupId);
    if (group?.lobby?.code) return `/lobby/${group.lobby.code}`;
  } catch {
    // Fall through to the group page.
  }
  return `/group/${groupId}`;
}

export function inviteUrl(joinCode: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/join/${encodeURIComponent(joinCode)}`;
}

export async function copyInviteLink(joinCode: string) {
  await navigator.clipboard.writeText(inviteUrl(joinCode));
}
