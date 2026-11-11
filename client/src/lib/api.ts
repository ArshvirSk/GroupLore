const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

let getTokenFn: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

export type LobbyPlayer = {
  lobby_id: string;
  user_id: string;
  display_name: string;
  is_guest: boolean;
  connected: boolean;
  joined_at: string;
};

export type Lobby = {
  id: string;
  code: string;
  group_id: string | null;
  host_id: string | null;
  status: "open" | "in_game" | "closed";
  created_at: string;
  closed_at: string | null;
  groups?: { id: string; name: string } | null;
  lobby_players: LobbyPlayer[];
  active_session_id?: string | null;
};

function messageFrom(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const error = (body as { error?: { message?: string } | string }).error;
  if (typeof error === "string") return error;
  return error?.message || fallback;
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = getTokenFn ? await getTokenFn() : null;
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(messageFrom(body, "Request failed"));
  }

  return res.json();
}

export const api = {
  getAuthConfig: () => apiRequest("/api/auth/config"),

  syncUser: () => apiRequest("/api/users/sync", { method: "POST" }),
  getMe: () => apiRequest("/api/users/me"),

  createGroup: (data: { name: string; avatarUrl?: string }) =>
    apiRequest("/api/groups", { method: "POST", body: JSON.stringify(data) }),
  getMyGroups: () => apiRequest("/api/groups/my"),
  getGroup: (id: string) => apiRequest(`/api/groups/${id}`),
  openGroupLobby: (groupId: string) =>
    apiRequest(`/api/groups/${groupId}/lobby`, { method: "POST" }),

  getMembers: (groupId: string) => apiRequest(`/api/members/group/${groupId}`),
  upsertMember: (groupId: string, data: Record<string, unknown>) =>
    apiRequest(`/api/members/group/${groupId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMember: (id: string) =>
    apiRequest(`/api/members/${id}`, { method: "DELETE" }),
  leaveGroup: (groupId: string) =>
    apiRequest(`/api/groups/${groupId}/leave`, { method: "DELETE" }),
  removeMember: (groupId: string, targetUserId: string) =>
    apiRequest(`/api/groups/${groupId}/members/${targetUserId}`, {
      method: "DELETE",
    }),

  createQuickLobby: () => apiRequest("/api/lobbies", { method: "POST" }),
  joinLobby: (code: string) =>
    apiRequest("/api/lobbies/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  getLobby: (code: string) =>
    apiRequest(`/api/lobbies/${encodeURIComponent(code)}`),
  leaveLobby: (id: string) =>
    apiRequest(`/api/lobbies/${id}/leave`, { method: "POST" }),
  kickLobbyPlayer: (id: string, userId: string) =>
    apiRequest(`/api/lobbies/${id}/kick`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  startLobby: (id: string, data: { gameId: string; mode: string }) =>
    apiRequest(`/api/lobbies/${id}/start`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCatalog: () => apiRequest("/api/games/catalog"),
  getGame: (id: string) => apiRequest(`/api/games/${id}`),

  getInvite: (code: string) =>
    apiRequest(`/api/invites/${encodeURIComponent(code)}`),

  sendNudge: (groupId: string) =>
    apiRequest(`/api/groups/${groupId}/nudge`, { method: "POST" }),
  getNudges: (groupId: string) => apiRequest(`/api/groups/${groupId}/nudges`),

  getFeed: (limit = 20, before?: string) =>
    apiRequest(
      `/api/feed?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    ),
  getMyStats: () => apiRequest("/api/feed/stats"),
  getActiveLobbies: () => apiRequest("/api/feed/active-lobbies"),
};
