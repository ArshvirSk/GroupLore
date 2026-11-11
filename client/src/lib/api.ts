const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

let getTokenFn: (() => Promise<string | null>) | null = null;

/** Called once by AuthProvider with the current Supabase access token. */
export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
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
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

export const api = {
  // Users — sync the Supabase Auth user into the app users table
  syncUser: () => apiRequest("/api/users/sync", { method: "POST" }),

  // Groups
  createGroup: (data: { name: string; avatarUrl?: string }) =>
    apiRequest("/api/groups", { method: "POST", body: JSON.stringify(data) }),

  getMyGroups: () => apiRequest("/api/groups/my"),

  getGroup: (id: string) => apiRequest(`/api/groups/${id}`),

  joinGroup: (data: { joinCode: string }) =>
    apiRequest("/api/groups/join", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Members
  getMembers: (groupId: string) => apiRequest(`/api/members/group/${groupId}`),

  upsertMember: (groupId: string, data: Record<string, unknown>) =>
    apiRequest(`/api/members/group/${groupId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteMember: (id: string) =>
    apiRequest(`/api/members/${id}`, { method: "DELETE" }),

  leaveGroup: (groupId: string) =>
    apiRequest(`/api/groups/${groupId}/leave`, {
      method: "DELETE",
    }),

  removeMember: (groupId: string, targetUserId: string) =>
    apiRequest(`/api/groups/${groupId}/members/${targetUserId}`, {
      method: "DELETE",
    }),

  // Games
  createGame: (data: { groupId: string; gameType: string }) =>
    apiRequest("/api/games", { method: "POST", body: JSON.stringify(data) }),

  getGame: (id: string) => apiRequest(`/api/games/${id}`),

  getActiveSession: (groupId: string) =>
    apiRequest(`/api/games/active/${groupId}`),

  // Nudges
  sendNudge: (groupId: string, from: string) =>
    apiRequest(`/api/groups/${groupId}/nudge`, {
      method: "POST",
      body: JSON.stringify({ from }),
    }),

  getNudges: (groupId: string) => apiRequest(`/api/groups/${groupId}/nudges`),

  // Feed — The Hub
  getFeed: (limit = 20, before?: string) =>
    apiRequest(
      `/api/feed?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ""}`,
    ),

  getMyStats: () => apiRequest("/api/feed/stats"),

  getActiveLobbies: () => apiRequest("/api/feed/active-lobbies"),
};
