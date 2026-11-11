import { api } from "@/lib/api";

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
