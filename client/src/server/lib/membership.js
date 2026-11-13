import { supabase } from "./supabase.js";

export async function isGroupMember(userId, groupId) {
  if (!userId || !groupId) return null;
  const { data } = await supabase
    .from("group_members")
    .select("group_id, user_id, role, joined_at")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export async function isGroupOwner(userId, groupId) {
  const membership = await isGroupMember(userId, groupId);
  return membership?.role === "owner";
}

/**
 * Resolve the legacy users.id for member_profiles only. New app code never
 * uses this id; it exists solely because member_profiles was intentionally
 * left untouched in this refactor.
 */
export async function legacyUserId(authUserId) {
  if (!authUserId) return null;
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data?.id || null;
}

/**
 * member_profiles still references users.id. New auth users get a legacy
 * bridge row on demand; member_profiles itself is never modified by auth code.
 */
export async function ensureLegacyUser(user) {
  if (!user?.id) return null;
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        auth_user_id: user.id,
        name: user.displayName || "Player",
        email: user.email || null,
        avatar_url: user.avatarUrl || null,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

function groupIdFromRequest(req, paramName) {
  return req.params?.[paramName] || req.body?.groupId || req.query?.groupId;
}

export function requireGroupMember(paramName = "id") {
  return async (req, res, next) => {
    try {
      const groupId = groupIdFromRequest(req, paramName);
      if (!groupId) {
        return res.status(400).json({
          error: { code: "group_required", message: "groupId is required" },
        });
      }
      const membership = await isGroupMember(req.user?.id, groupId);
      if (!membership) {
        return res.status(403).json({
          error: {
            code: "not_group_member",
            message: "You are not a member of this group",
          },
        });
      }
      req.groupMembership = membership;
      req.groupId = groupId;
      return next();
    } catch (err) {
      console.error("Membership check error:", err?.message || err);
      return res.status(500).json({
        error: { code: "server_error", message: "Failed to verify membership" },
      });
    }
  };
}

export function requireGroupOwner(paramName = "id") {
  return async (req, res, next) => {
    try {
      const groupId = groupIdFromRequest(req, paramName);
      const membership = await isGroupMember(req.user?.id, groupId);
      if (!membership) {
        return res.status(403).json({
          error: {
            code: "not_group_member",
            message: "You are not a member of this group",
          },
        });
      }
      if (membership.role !== "owner") {
        return res.status(403).json({
          error: {
            code: "owner_only",
            message: "Only the group owner can do that",
          },
        });
      }
      req.groupMembership = membership;
      req.groupId = groupId;
      return next();
    } catch (err) {
      console.error("Owner check error:", err?.message || err);
      return res.status(500).json({
        error: { code: "server_error", message: "Failed to verify ownership" },
      });
    }
  };
}

export async function loadLobby(lobbyId) {
  if (!lobbyId) return null;
  const { data } = await supabase
    .from("lobbies")
    .select("*, groups(id, name), lobby_players(*)")
    .eq("id", lobbyId)
    .maybeSingle();
  return data || null;
}

export function requireHost(paramName = "id") {
  return async (req, res, next) => {
    try {
      const lobbyId = req.params?.[paramName] || req.body?.lobbyId;
      const lobby = await loadLobby(lobbyId);
      if (!lobby) {
        return res.status(404).json({
          error: { code: "lobby_not_found", message: "That lobby no longer exists" },
        });
      }
      if (lobby.host_id !== req.user?.id) {
        return res.status(403).json({
          error: { code: "host_only", message: "Only the host can do that" },
        });
      }
      req.lobby = lobby;
      return next();
    } catch (err) {
      console.error("Host check error:", err?.message || err);
      return res.status(500).json({
        error: { code: "server_error", message: "Failed to verify host" },
      });
    }
  };
}

export async function requireLobbyMember(req, res, next) {
  try {
    const lobbyId = req.params?.id || req.body?.lobbyId;
    const lobby = await loadLobby(lobbyId);
    if (!lobby) {
      return res.status(404).json({
        error: { code: "lobby_not_found", message: "That lobby no longer exists" },
      });
    }
    const player = lobby.lobby_players?.find(
      (entry) => entry.user_id === req.user?.id,
    );
    if (!player) {
      return res.status(403).json({
        error: { code: "not_in_lobby", message: "Join this lobby first" },
      });
    }
    req.lobby = lobby;
    req.lobbyPlayer = player;
    return next();
  } catch (err) {
    console.error("Lobby membership error:", err?.message || err);
    return res.status(500).json({
      error: { code: "server_error", message: "Failed to verify lobby access" },
    });
  }
}

export async function requireSessionMember(req, res, next) {
  try {
    const sessionId = req.params.id || req.params.sessionId;
    if (!sessionId) {
      return res.status(400).json({
        error: { code: "session_required", message: "Session id is required" },
      });
    }
    const { data: session } = await supabase
      .from("game_sessions")
      .select("*, lobbies(id, status, group_id, host_id, lobby_players(user_id))")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) {
      return res.status(404).json({
        error: { code: "session_not_found", message: "Session not found" },
      });
    }
    const isMember = session.lobbies?.lobby_players?.some(
      (entry) => entry.user_id === req.user?.id,
    );
    if (!isMember) {
      return res.status(403).json({
        error: { code: "not_in_lobby", message: "Join this lobby first" },
      });
    }
    req.gameSession = session;
    req.lobby = session.lobbies;
    return next();
  } catch (err) {
    console.error("Session membership error:", err?.message || err);
    return res.status(500).json({
      error: { code: "server_error", message: "Failed to verify session access" },
    });
  }
}

/**
 * Socket authorization: membership is proven by a lobby_players row. It never
 * trusts a group id or player id sent by the client.
 */
export async function authorizeLobbyPlayer({ identity, lobbyId, allowGuests }) {
  if (!identity?.authUserId) return { allowed: false };
  if (identity.isGuest && !allowGuests) return { allowed: false };

  const { data: player } = await supabase
    .from("lobby_players")
    .select("lobby_id, user_id, display_name, is_guest, connected")
    .eq("lobby_id", lobbyId)
    .eq("user_id", identity.authUserId)
    .maybeSingle();

  if (!player) return { allowed: false };
  return {
    allowed: true,
    userId: identity.authUserId,
    name: player.display_name || identity.name,
    avatarUrl: identity.avatarUrl || null,
    isGuest: Boolean(player.is_guest),
  };
}
