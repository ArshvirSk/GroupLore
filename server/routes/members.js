import { Router } from "express";
import { requireNonGuest, requireUser } from "../lib/auth.js";
import { fail, notFound, serverError } from "../lib/http.js";
import {
  ensureLegacyUser,
  isGroupMember,
  legacyUserId,
  requireGroupMember,
} from "../lib/membership.js";
import { supabase } from "../lib/supabase.js";

const router = Router();
router.use(requireUser, requireNonGuest);

function sanitizeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 20);
}

// Get the legacy member-profile rows for a group (members only).
router.get("/group/:groupId", requireGroupMember("groupId"), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("group_id", req.params.groupId);
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("Get members error:", err?.message || err);
    return serverError(res, "Failed to fetch members");
  }
});

// Create or update a member profile. Members edit their own; group owners edit
// anyone. member_profiles stays on its legacy users.id bridge.
router.post(
  "/group/:groupId",
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
        return fail(res, 400, "display_name_required", "displayName is required");
      }

      const targetAuthId = requestedUserId || req.user.id;
      if (targetAuthId !== req.user.id) {
        const targetMembership = await isGroupMember(targetAuthId, groupId);
        if (!targetMembership) {
          return fail(res, 400, "not_group_member", "That user is not in this group");
        }
        if (req.groupMembership.role !== "owner") {
          return fail(
            res,
            403,
            "owner_only",
            "Only the group owner can edit another member's profile",
          );
        }
      }

      const targetUserId =
        targetAuthId === req.user.id
          ? await ensureLegacyUser(req.user)
          : await legacyUserId(targetAuthId);
      if (!targetUserId) {
        return fail(res, 400, "user_not_found", "That user has no legacy profile row");
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

      if (existing) {
        const { data, error } = await supabase
          .from("member_profiles")
          .update(profileData)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return res.json(data);
      }

      const { data, error } = await supabase
        .from("member_profiles")
        .insert(profileData)
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    } catch (err) {
      console.error("Upsert member error:", err?.message || err);
      return serverError(res, "Failed to save member profile");
    }
  },
);

router.delete("/:id", async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from("member_profiles")
      .select("id, group_id, user_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (!profile) return notFound(res, "Profile not found");

    const membership = await isGroupMember(req.user.id, profile.group_id);
    if (!membership) {
      return fail(res, 403, "not_group_member", "You are not in this group");
    }

    const ownLegacyId = await legacyUserId(req.user.id);
    const isSelf = ownLegacyId && profile.user_id === ownLegacyId;
    if (!isSelf && membership.role !== "owner") {
      return fail(
        res,
        403,
        "owner_only",
        "Only the group owner can remove another member's profile",
      );
    }

    const { error } = await supabase
      .from("member_profiles")
      .delete()
      .eq("id", req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete member error:", err?.message || err);
    return serverError(res, "Failed to delete member profile");
  }
});

export default router;
