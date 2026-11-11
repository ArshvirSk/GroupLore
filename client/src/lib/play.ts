import { api } from "@/lib/api";
import { createGuestIdentity } from "@/lib/guest";

export type InviteInfo = {
  group: { id: string; name: string };
  lobby: { id: string; game_type: string; created_at: string } | null;
  guestsEnabled: boolean;
};

export async function getInvite(code: string): Promise<InviteInfo> {
  return api.getInvite(code) as Promise<InviteInfo>;
}

/** Guests can only enter an already-open lobby; they never join the group. */
export async function joinOpenLobbyAsGuest(name: string, code: string) {
  const invite = await getInvite(code);
  if (!invite.guestsEnabled) {
    throw new Error("Guest play is disabled on this server");
  }
  if (!invite.lobby) {
    throw new Error("No lobby is open for that code. Ask the host to open one.");
  }

  await createGuestIdentity(name);
  return invite.lobby.id;
}

/** Returns the existing lobby for a group or creates one. */
export async function ensureLobby(groupId: string) {
  return api.createGame({ groupId, gameType: "most-likely-to" });
}

/** Lobby when one is open, otherwise the group page. */
export async function groupEntryPath(groupId: string) {
  const lobby = await api.getActiveSession(groupId).catch(() => null);
  return lobby
    ? `/lobby/${lobby.id}?groupId=${groupId}`
    : `/group/${groupId}`;
}

export function inviteUrl(joinCode: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/join/${encodeURIComponent(joinCode)}`;
}

export async function copyInviteLink(joinCode: string) {
  await navigator.clipboard.writeText(inviteUrl(joinCode));
}
