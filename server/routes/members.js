import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  isGroupMember,
  requireGroupMember,
  resolveDbUser,
} from "../lib/membership.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

function sanitizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 20);
}

// Get all member profiles for a group (members only).
router.get("/group/:groupId", requireAuth, requireGroupMember("groupId"), async (req, res) => {
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

// Create or update a member profile.
// Members may edit their own profile; only the host may edit someone else's.
router.post(
  "/group/:groupId",
  requireAuth,
  requireGroupMember("groupId"),
  async (req, res) => {
    try {
      const { groupId } = req.params;
      const {
        userId: requestedUserId,
        displayName,
        nickname,
        traits,
        habits,
        iconicMoments,
        catchphrases,
        mostLikelyTo,
        avatarUrl,
      } = req.body;

      if (!displayName || typeof displayName !== "string") {
        return res.status(400).json({ error: "displayName is required" });
      }

      const targetUserId = requestedUserId || req.dbUserId;
      if (targetUserId !== req.dbUserId) {
        if (req.groupMembership.role !== "host") {
          return res
            .status(403)
            .json({ error: "Only the host can edit another member's profile" });
        }
        const targetMembership = await isGroupMember(targetUserId, groupId);
        if (!targetMembership) {
          return res.status(400).json({ error: "That user is not in this group" });
        }
      }

      const { data: existing } = await supabase
        .from("member_profiles")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", targetUserId)
        .maybeSingle();

      const profileData = {
        group_id: groupId,
        user_id: targetUserId,
        display_name: displayName.trim().slice(0, 60),
        nickname: typeof nickname === "string" ? nickname.trim().slice(0, 60) : null,
        traits: sanitizeList(traits),
        habits: sanitizeList(habits),
        iconic_moments: sanitizeList(iconicMoments),
        catchphrases: sanitizeList(catchphrases),
        most_likely_to: sanitizeList(mostLikelyTo),
        avatar_url:
          typeof avatarUrl === "string" && avatarUrl.startsWith("http")
            ? avatarUrl
            : null,
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
  },
);

// Delete a member profile (self or group host only).
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from("member_profiles")
      .select("id, group_id, user_id")
      .eq("id", req.params.id)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const user = await resolveDbUser(req.clerkUserId);
    if (!user) return res.status(404).json({ error: "User not synced" });

    const membership = await isGroupMember(user.id, profile.group_id);
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this group" });
    }

    const isSelf = profile.user_id === user.id;
    if (!isSelf && membership.role !== "host") {
      return res
        .status(403)
        .json({ error: "Only the host can remove another member's profile" });
    }

    const { error } = await supabase
      .from("member_profiles")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Delete member error:", err);
    res.status(500).json({ error: "Failed to delete member profile" });
  }
});

export default router;
