import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

/**
 * Helper: resolve Clerk userId → Supabase UUID.
 */
async function resolveUserId(clerkUserId) {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkUserId)
    .single();
  return data?.id || null;
}

// Get all member profiles for a group
router.get("/group/:groupId", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("group_id", req.params.groupId);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Get members error:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// Create or update a member profile
router.post("/group/:groupId", requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const {
      userId: targetUserId,
      displayName,
      nickname,
      traits,
      habits,
      iconicMoments,
      catchphrases,
      mostLikelyTo,
      avatarUrl,
    } = req.body;

    if (!displayName) {
      return res.status(400).json({ error: "displayName is required" });
    }

    // Use provided targetUserId (for editing others) or resolve from Clerk
    let dbUserId = targetUserId || null;
    if (!dbUserId) {
      dbUserId = await resolveUserId(req.clerkUserId);
    }

    // Check if profile exists
    const { data: existing } = await supabase
      .from("member_profiles")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", dbUserId)
      .single();

    const profileData = {
      group_id: groupId,
      user_id: dbUserId || null,
      display_name: displayName,
      nickname: nickname || null,
      traits: traits || [],
      habits: habits || [],
      iconic_moments: iconicMoments || [],
      catchphrases: catchphrases || [],
      most_likely_to: mostLikelyTo || [],
      avatar_url: avatarUrl || null,
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("member_profiles")
        .update(profileData)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("member_profiles")
        .insert(profileData)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.json(result);
  } catch (err) {
    console.error("Upsert member error:", err);
    res.status(500).json({ error: "Failed to save member profile" });
  }
});

// Delete member profile
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("member_profiles")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Delete member error:", err);
    res.status(500).json({ error: "Failed to delete member" });
  }
});

export default router;
