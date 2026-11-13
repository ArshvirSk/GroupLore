import "server-only";
import type { NextRequest } from "next/server";
import { guestsAllowed } from "../lib/guestAccess.js";
import { ensureProfile } from "../lib/auth.js";
import { isGroupMember, loadLobby } from "../lib/membership.js";
import { supabase } from "../lib/supabase.js";
import { ApiFailure } from "./http";

export type ApiUser = {
  id: string;
  isGuest: boolean;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  profile: Record<string, unknown>;
  authUser: {
    id: string;
    is_anonymous?: boolean;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
};

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function requireUser(request: NextRequest): Promise<ApiUser> {
  const token = bearerToken(request);
  if (!token) {
    throw new ApiFailure(401, "unauthorized", "Sign in to play");
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw new ApiFailure(401, "unauthorized", "Sign in to play");
    }
    if (data.user.is_anonymous && !guestsAllowed()) {
      throw new ApiFailure(
        403,
        "guests_disabled",
        "Guest play is disabled. Sign in with an account to continue.",
      );
    }

    const profile = await ensureProfile(data.user);
    return {
      id: data.user.id,
      isGuest: Boolean(data.user.is_anonymous),
      email: data.user.email || null,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      profile,
      authUser: data.user,
    };
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    console.error("Auth error:", error);
    throw new ApiFailure(401, "unauthorized", "Could not verify your session");
  }
}

export function requireNonGuest(user: ApiUser) {
  if (user.isGuest) {
    throw new ApiFailure(
      403,
      "guest_forbidden",
      "Create an account to use groups and quick play.",
    );
  }
  return user;
}

export async function requireGroupMember(userId: string, groupId?: string | null) {
  if (!groupId) {
    throw new ApiFailure(400, "group_required", "groupId is required");
  }

  try {
    const membership = await isGroupMember(userId, groupId);
    if (!membership) {
      throw new ApiFailure(
        403,
        "not_group_member",
        "You are not a member of this group",
      );
    }
    return membership;
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    console.error("Membership check error:", error);
    throw new ApiFailure(500, "server_error", "Failed to verify membership");
  }
}

export async function requireGroupOwner(userId: string, groupId?: string | null) {
  const membership = await requireGroupMember(userId, groupId);
  if (membership.role !== "owner") {
    throw new ApiFailure(403, "owner_only", "Only the group owner can do that");
  }
  return membership;
}

export async function requireHost(userId: string, lobbyId?: string | null) {
  if (!lobbyId) {
    throw new ApiFailure(404, "lobby_not_found", "That lobby no longer exists");
  }

  try {
    const lobby = await loadLobby(lobbyId);
    if (!lobby) {
      throw new ApiFailure(404, "lobby_not_found", "That lobby no longer exists");
    }
    if (lobby.host_id !== userId) {
      throw new ApiFailure(403, "host_only", "Only the host can do that");
    }
    return lobby;
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    console.error("Host check error:", error);
    throw new ApiFailure(500, "server_error", "Failed to verify host");
  }
}

export async function requireLobbyMember(userId: string, lobbyId?: string | null) {
  if (!lobbyId) {
    throw new ApiFailure(404, "lobby_not_found", "That lobby no longer exists");
  }

  try {
    const lobby = await loadLobby(lobbyId);
    if (!lobby) {
      throw new ApiFailure(404, "lobby_not_found", "That lobby no longer exists");
    }
    const player = lobby.lobby_players?.find(
      (entry: { user_id: string }) => entry.user_id === userId,
    );
    if (!player) {
      throw new ApiFailure(403, "not_in_lobby", "Join this lobby first");
    }
    return { lobby, player };
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    console.error("Lobby membership error:", error);
    throw new ApiFailure(500, "server_error", "Failed to verify lobby access");
  }
}

export async function requireSessionMember(userId: string, sessionId?: string | null) {
  if (!sessionId) {
    throw new ApiFailure(400, "session_required", "Session id is required");
  }

  try {
    const { data: session } = await supabase
      .from("game_sessions")
      .select("*, lobbies(id, status, group_id, host_id, lobby_players(user_id))")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) {
      throw new ApiFailure(404, "session_not_found", "Session not found");
    }

    const isMember = session.lobbies?.lobby_players?.some(
      (entry: { user_id: string }) => entry.user_id === userId,
    );
    if (!isMember) {
      throw new ApiFailure(403, "not_in_lobby", "Join this lobby first");
    }
    return session;
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    console.error("Session membership error:", error);
    throw new ApiFailure(500, "server_error", "Failed to verify session access");
  }
}

export function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
