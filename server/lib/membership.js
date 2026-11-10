import { supabase } from "./supabase.js";

export async function resolveDbUser(clerkId) {
  if (!clerkId) return null;
  const { data } = await supabase
    .from("users")
    .select("id, clerk_id, name, avatar_url")
    .eq("clerk_id", clerkId)
    .maybeSingle();
  return data || null;
}

export async function isGroupMember(userId, groupId) {
  if (!userId || !groupId) return false;
  const { data } = await supabase
    .from("group_members")
    .select("id, role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

/**
 * Socket-side authorization: proves the connected identity belongs to the
 * room's group. Guests are allowed only when the deployment opts in.
 */
export async function authorizePlayer({ identity, groupId, allowGuests }) {
  if (!identity) return { allowed: false };

  if (identity.kind === "clerk") {
    const user = await resolveDbUser(identity.clerkId);
    if (!user) return { allowed: false };
    const membership = await isGroupMember(user.id, groupId);
    if (!membership) return { allowed: false };
    return {
      allowed: true,
      userId: user.id,
      name: user.name || identity.name,
      avatarUrl: user.avatar_url || identity.avatarUrl || null,
    };
  }

  if (identity.kind === "guest" && allowGuests) {
    return {
      allowed: true,
      userId: null,
      name: identity.name,
      avatarUrl: null,
    };
  }

  return { allowed: false };
}

/**
 * Express middleware. Must run after requireAuth.
 * Resolves the Clerk user to its DB row and checks membership of the group.
 */
export function requireGroupMember(paramName = "groupId") {
  return async (req, res, next) => {
    try {
      const groupId =
        req.params?.[paramName] || req.body?.groupId || req.query?.groupId;
      if (!groupId) {
        return res.status(400).json({ error: "groupId required" });
      }

      const user = await resolveDbUser(req.clerkUserId);
      if (!user) {
        return res.status(404).json({ error: "User not synced" });
      }

      const membership = await isGroupMember(user.id, groupId);
      if (!membership) {
        return res.status(403).json({ error: "Not a member of this group" });
      }

      req.dbUserId = user.id;
      req.dbUser = user;
      req.groupMembership = membership;
      return next();
    } catch (err) {
      console.error("Membership check error:", err);
      return res.status(500).json({ error: "Failed to verify membership" });
    }
  };
}

export function requireGroupHost(paramName = "groupId") {
  return async (req, res, next) => {
    try {
      const groupId =
        req.params?.[paramName] || req.body?.groupId || req.query?.groupId;
      const user = await resolveDbUser(req.clerkUserId);
      if (!user) return res.status(404).json({ error: "User not synced" });

      const membership = await isGroupMember(user.id, groupId);
      if (!membership) {
        return res.status(403).json({ error: "Not a member of this group" });
      }
      if (membership.role !== "host") {
        return res.status(403).json({ error: "Only the host can do that" });
      }

      req.dbUserId = user.id;
      req.dbUser = user;
      req.groupMembership = membership;
      return next();
    } catch (err) {
      console.error("Host check error:", err);
      return res.status(500).json({ error: "Failed to verify membership" });
    }
  };
}

/**
 * Express middleware for game-session routes. Resolves the session's group and
 * verifies the caller belongs to it.
 */
export async function requireSessionMember(req, res, next) {
  try {
    const sessionId = req.params.id || req.params.sessionId;
    if (!sessionId) return res.status(400).json({ error: "Session id required" });

    const { data: session } = await supabase
      .from("game_sessions")
      .select("id, group_id, status, game_type")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session) return res.status(404).json({ error: "Session not found" });

    const user = await resolveDbUser(req.clerkUserId);
    if (!user) return res.status(404).json({ error: "User not synced" });

    const membership = await isGroupMember(user.id, session.group_id);
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this group" });
    }

    req.dbUserId = user.id;
    req.dbUser = user;
    req.gameSession = session;
    req.groupMembership = membership;
    return next();
  } catch (err) {
    console.error("Session membership error:", err);
    return res.status(500).json({ error: "Failed to verify session access" });
  }
}
