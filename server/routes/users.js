import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

function profileFromAuthUser(user) {
  const meta = user.user_metadata || {};
  const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(" ");
  const displayName =
    meta.full_name ||
    meta.name ||
    meta.display_name ||
    fullName ||
    user.email?.split("@")[0] ||
    "User";

  return {
    displayName: String(displayName).trim().slice(0, 60) || "User",
    email: user.email || null,
    avatarUrl: meta.avatar_url || meta.picture || null,
  };
}

/**
 * POST /api/users/sync
 * Called once per session. Resolves the Supabase Auth user to a `users` row.
 * Creates the row if it doesn't exist, or links an existing row by email so
 * accounts created before the auth migration keep their groups and stats.
 */
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const authUser = req.authUser;
    const { displayName, email, avatarUrl } = profileFromAuthUser(authUser);

    let { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (!existing && email) {
      const { data: byEmail } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      existing = byEmail || null;
    }

    let dbUserId;

    if (existing) {
      const { error } = await supabase
        .from("users")
        .update({
          auth_user_id: authUser.id,
          name: displayName,
          email,
          avatar_url: avatarUrl,
        })
        .eq("id", existing.id);
      if (error) throw error;
      dbUserId = existing.id;
    } else {
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          auth_user_id: authUser.id,
          name: displayName,
          email,
          avatar_url: avatarUrl,
        })
        .select("id")
        .single();

      if (error) throw error;
      dbUserId = newUser.id;
    }

    res.json({ dbUserId, displayName, avatarUrl });
  } catch (err) {
    console.error("User sync error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

/**
 * GET /api/users/me
 * Returns the current user's app profile.
 */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", req.authUserId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "User not found — sync first" });
    }

    res.json(user);
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

export default router;
