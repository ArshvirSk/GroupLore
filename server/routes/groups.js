import { Router } from "express";
import { logActivity } from "../lib/activity.js";
import { requireAuth } from "../lib/auth.js";
import { requireGroupHost, requireGroupMember } from "../lib/membership.js";
import { supabase } from "../lib/supabase.js";
import { generateJoinCode } from "../utils/helpers.js";

const router = Router();

/**
 * Helper: resolve the Supabase auth user id to the app users UUID.
 * Returns the existing UUID or null if not found.
 */
async function resolveUserId(authUserId) {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  return data?.id || null;
}

// Create a new group
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, avatarUrl } = req.body;
    const authUserId = req.authUserId;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const dbUserId = await resolveUserId(authUserId);
    if (!dbUserId) {
      return res.status(400).json({ error: "User not synced — call /api/users/sync first" });
    }

    let joinCode = generateJoinCode();

    // Ensure join code is unique
    let existing = true;
    while (existing) {
      const { data } = await supabase
        .from("groups")
        .select("id")
        .eq("join_code", joinCode)
        .single();
      if (!data) existing = false;
      else joinCode = generateJoinCode();
    }

    // Fetch user display name for auto-profile
    const { data: userRow } = await supabase
      .from("users")
      .select("name")
      .eq("id", dbUserId)
      .single();
    const displayName = userRow?.name || "Host";

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name,
        avatar_url: avatarUrl || null,
        created_by: dbUserId,
        join_code: joinCode,
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as host member
    await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: dbUserId,
      role: "host",
    });

    // Auto-create a basic member profile
    await supabase.from("member_profiles").insert({
      group_id: group.id,
      user_id: dbUserId,
      display_name: displayName,
      traits: [],
      habits: [],
      iconic_moments: [],
      catchphrases: [],
      most_likely_to: [],
    });

    res.status(201).json(group);
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// Get current user's groups
router.get("/my", requireAuth, async (req, res) => {
  try {
    const dbUserId = await resolveUserId(req.authUserId);
    if (!dbUserId) return res.json([]);

    const { data: memberships, error } = await supabase
      .from("group_members")
      .select("group_id, role, groups(*)")
      .eq("user_id", dbUserId);

    if (error) throw error;

    const groups = memberships.map((m) => ({
      ...m.groups,
      role: m.role,
    }));

    res.json(groups);
  } catch (err) {
    console.error("Get groups error:", err);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Get group by ID
router.get("/:id", requireAuth, requireGroupMember("id"), async (req, res) => {
  try {
    const { data: group, error } = await supabase
      .from("groups")
      .select("*, group_members(*, users(*))")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!group) return res.status(404).json({ error: "Group not found" });

    res.json(group);
  } catch (err) {
    console.error("Get group error:", err);
    res.status(500).json({ error: "Failed to fetch group" });
  }
});

// Join group via code
router.post("/join", requireAuth, async (req, res) => {
  try {
    const { joinCode } = req.body;

    if (!joinCode) {
      return res.status(400).json({ error: "joinCode is required" });
    }

    const dbUserId = await resolveUserId(req.authUserId);
    if (!dbUserId) {
      return res.status(400).json({ error: "User not synced" });
    }

    // Fetch user display name
    const { data: userRow } = await supabase
      .from("users")
      .select("name")
      .eq("id", dbUserId)
      .single();
    const displayName = userRow?.name || "Member";

    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("*")
      .eq("join_code", joinCode.toUpperCase())
      .single();

    if (groupErr || !group) {
      return res.status(404).json({ error: "Invalid join code" });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", dbUserId)
      .single();

    if (existing) {
      return res.json({ ...group, alreadyMember: true });
    }

    await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: dbUserId,
      role: "member",
    });

    // Auto-create a basic member profile
    await supabase.from("member_profiles").insert({
      group_id: group.id,
      user_id: dbUserId,
      display_name: displayName,
      traits: [],
      habits: [],
      iconic_moments: [],
      catchphrases: [],
      most_likely_to: [],
    });

    // Log activity
    logActivity({
      groupId: group.id,
      userId: dbUserId,
      eventType: "member_joined",
      payload: { displayName },
    });

    res.json(group);
  } catch (err) {
    console.error("Join group error:", err);
    res.status(500).json({ error: "Failed to join group" });
  }
});

// Leave group (self)
router.delete("/:groupId/leave", requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const dbUserId = await resolveUserId(req.authUserId);
    if (!dbUserId) return res.status(400).json({ error: "User not synced" });

    // Get the group with members
    const { data: group } = await supabase
      .from("groups")
      .select("*, group_members(*)")
      .eq("id", groupId)
      .single();

    if (!group) return res.status(404).json({ error: "Group not found" });

    // Remove from group_members
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", dbUserId);

    // Remove their member_profile
    await supabase
      .from("member_profiles")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", dbUserId);

    // Check remaining members
    const { data: remaining } = await supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId);

    if (!remaining || remaining.length === 0) {
      await supabase.from("groups").delete().eq("id", groupId);
      return res.json({ success: true, groupDeleted: true });
    }

    // If the leaving user was the host, transfer to next member
    const wasHost = group.group_members?.find(
      (m) => m.user_id === dbUserId && m.role === "host",
    );
    if (wasHost) {
      await supabase
        .from("group_members")
        .update({ role: "host" })
        .eq("id", remaining[0].id);
    }

    // Log activity
    logActivity({
      groupId,
      userId: dbUserId,
      eventType: "member_left",
      payload: {},
    });

    res.json({ success: true, groupDeleted: false });
  } catch (err) {
    console.error("Leave group error:", err);
    res.status(500).json({ error: "Failed to leave group" });
  }
});

// Remove member (host only)
router.delete("/:groupId/members/:targetUserId", requireAuth, async (req, res) => {
  try {
    const { groupId, targetUserId } = req.params;
    const dbUserId = await resolveUserId(req.authUserId);
    if (!dbUserId) return res.status(400).json({ error: "User not synced" });

    // Verify requesting user is the host
    const { data: membership } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", dbUserId)
      .single();

    if (!membership || membership.role !== "host") {
      return res.status(403).json({ error: "Only the host can remove members" });
    }

    // Remove from group_members
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    // Remove their member_profile
    await supabase
      .from("member_profiles")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    res.json({ success: true });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ── Nudge System (in-memory) ──
const nudges = new Map(); // groupId -> { message, from, timestamp }[]

const NUDGE_MESSAGES = [
  "START THE GAME ALREADY",
  "We're literally dying of boredom here",
  "The vibes are dying. START IT.",
  "Hello?? Is this thing on?? 🎤",
  "If you don't start in 10 seconds I'm leaving",
  "My grandma loads faster than you",
  "The suspense is killing us... START IT",
  "We didn't come here to stare at a screen",
  "Bro thinks we have all day 💀",
  "I've aged 3 years waiting for you",
  "The game isn't gonna start itself bestie",
  "WAKE UP. START. THE. GAME.",
];

// Send a nudge to the group's host (members only; sender comes from auth)
router.post("/:id/nudge", requireAuth, requireGroupMember("id"), (req, res) => {
  const from = req.dbUser?.name || "A member";
  const groupId = req.params.id;

  if (!nudges.has(groupId)) nudges.set(groupId, []);

  const msg = NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];

  nudges.get(groupId).push({
    message: msg,
    from: from || "Someone",
    timestamp: Date.now(),
  });

  // Keep only the last 10 nudges
  const arr = nudges.get(groupId);
  if (arr.length > 10) nudges.set(groupId, arr.slice(-10));

  res.json({ sent: true, message: msg });
});

// Poll for nudges (host only)
router.get("/:id/nudges", requireAuth, requireGroupHost("id"), (req, res) => {
  const groupId = req.params.id;
  const pending = nudges.get(groupId) || [];

  // Clear after reading
  nudges.set(groupId, []);

  res.json(pending);
});

export default router;
