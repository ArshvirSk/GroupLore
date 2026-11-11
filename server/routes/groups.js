import { Router } from "express";
import { logActivity } from "../lib/activity.js";
import { requireNonGuest, requireUser } from "../lib/auth.js";
import { fail, notFound, serverError } from "../lib/http.js";
import {
  requireGroupMember,
  requireGroupOwner,
} from "../lib/membership.js";
import { ensureLegacyUser } from "../lib/membership.js";
import { openGroupLobby } from "../lib/lobby.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

function cleanGroupName(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 60);
}

async function openLobbiesFor(groupIds) {
  if (groupIds.length === 0) return new Map();
  const { data } = await supabase
    .from("lobbies")
    .select("*, lobby_players(*)")
    .in("group_id", groupIds)
    .eq("status", "open");
  return new Map((data || []).map((lobby) => [lobby.group_id, lobby]));
}

// Create a group and make the creator its owner.
router.post("/", requireUser, requireNonGuest, async (req, res) => {
  const name = cleanGroupName(req.body?.name);
  if (!name) return fail(res, 400, "name_required", "Group name is required");

  try {
    await ensureLegacyUser(req.user);
    const { data: group, error } = await supabase
      .from("groups")
      .insert({ name, owner_id: req.user.id })
      .select("*")
      .single();
    if (error) throw error;

    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: req.user.id, role: "owner" });
    if (memberError) {
      await supabase.from("groups").delete().eq("id", group.id);
      throw memberError;
    }

    logActivity({
      groupId: group.id,
      userId: req.user.id,
      eventType: "member_joined",
      payload: { displayName: req.user.displayName },
    });

    return res.status(201).json({ ...group, role: "owner", lobby: null });
  } catch (err) {
    console.error("Create group error:", err?.message || err);
    return serverError(res, "Failed to create group");
  }
});

async function listGroups(req, res) {
  try {
    const { data: memberships, error } = await supabase
      .from("group_members")
      .select("group_id, role, joined_at, groups(*)")
      .eq("user_id", req.user.id);
    if (error) throw error;

    const groups = (memberships || [])
      .filter((membership) => membership.groups)
      .map((membership) => ({
        ...membership.groups,
        role: membership.role,
        joined_at: membership.joined_at,
      }));
    const lobbies = await openLobbiesFor(groups.map((group) => group.id));
    return res.json(
      groups.map((group) => ({ ...group, lobby: lobbies.get(group.id) || null })),
    );
  } catch (err) {
    console.error("Get groups error:", err?.message || err);
    return serverError(res, "Failed to fetch groups");
  }
}

router.get("/", requireUser, requireNonGuest, listGroups);
router.get("/my", requireUser, requireNonGuest, listGroups);

router.get(
  "/:id",
  requireUser,
  requireNonGuest,
  requireGroupMember("id"),
  async (req, res) => {
    try {
      const { data: group, error } = await supabase
        .from("groups")
        .select(
          "*, group_members(role, joined_at, profiles(id, display_name, avatar_url, is_guest))",
        )
        .eq("id", req.params.id)
        .maybeSingle();
      if (error) throw error;
      if (!group) return notFound(res, "Group not found");

      const { data: lobby } = await supabase
        .from("lobbies")
        .select("*, lobby_players(*)")
        .eq("group_id", group.id)
        .eq("status", "open")
        .maybeSingle();

      return res.json({
        ...group,
        role: req.groupMembership.role,
        members: (group.group_members || []).map((member) => ({
          ...member.profiles,
          id: member.profiles?.id,
          user_id: member.profiles?.id,
          role: member.role,
          joined_at: member.joined_at,
        })),
        lobby: lobby || null,
      });
    } catch (err) {
      console.error("Get group error:", err?.message || err);
      return serverError(res, "Failed to fetch group");
    }
  },
);

// Any member may open the group's room; an existing open room is returned.
router.post(
  "/:id/lobby",
  requireUser,
  requireNonGuest,
  requireGroupMember("id"),
  async (req, res) => {
    try {
      const { lobby, created } = await openGroupLobby({
        groupId: req.params.id,
        user: req.user,
      });
      return res.status(created ? 201 : 200).json(lobby);
    } catch (err) {
      console.error("Open group lobby error:", err?.message || err);
      return serverError(res, "Failed to open the group lobby");
    }
  },
);

router.delete("/:groupId/leave", requireUser, requireNonGuest, async (req, res) => {
  const { groupId } = req.params;
  try {
    const membership = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (!membership.data) {
      return fail(res, 403, "not_group_member", "You are not in this group");
    }

    const { data: remaining } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", groupId)
      .neq("user_id", req.user.id)
      .order("joined_at", { ascending: true });

    if (!remaining || remaining.length === 0) {
      await supabase.from("groups").delete().eq("id", groupId);
      return res.json({ success: true, groupDeleted: true });
    }

    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", req.user.id);

    if (membership.data.role === "owner") {
      const next = remaining[0];
      await supabase
        .from("group_members")
        .update({ role: "owner" })
        .eq("group_id", groupId)
        .eq("user_id", next.user_id);
      await supabase
        .from("groups")
        .update({ owner_id: next.user_id })
        .eq("id", groupId);
    }

    logActivity({
      groupId,
      userId: req.user.id,
      eventType: "member_left",
      payload: {},
    });
    return res.json({ success: true, groupDeleted: false });
  } catch (err) {
    console.error("Leave group error:", err?.message || err);
    return serverError(res, "Failed to leave group");
  }
});

router.delete(
  "/:groupId/members/:targetUserId",
  requireUser,
  requireNonGuest,
  requireGroupOwner("groupId"),
  async (req, res) => {
    if (req.params.targetUserId === req.user.id) {
      return fail(
        res,
        400,
        "cannot_remove_self",
        "Use leave group to remove yourself",
      );
    }
    try {
      const { data: target } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", req.params.groupId)
        .eq("user_id", req.params.targetUserId)
        .maybeSingle();
      if (!target) return notFound(res, "That member is not in this group");

      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", req.params.groupId)
        .eq("user_id", req.params.targetUserId);
      return res.json({ success: true });
    } catch (err) {
      console.error("Remove member error:", err?.message || err);
      return serverError(res, "Failed to remove member");
    }
  },
);

// ── Nudge System (in-memory) ──
const nudges = new Map();
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

router.post(
  "/:id/nudge",
  requireUser,
  requireNonGuest,
  requireGroupMember("id"),
  (req, res) => {
    const groupId = req.params.id;
    if (!nudges.has(groupId)) nudges.set(groupId, []);
    const message =
      NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
    nudges.get(groupId).push({
      message,
      from: req.user.displayName,
      timestamp: Date.now(),
    });
    if (nudges.get(groupId).length > 10) {
      nudges.set(groupId, nudges.get(groupId).slice(-10));
    }
    res.json({ sent: true, message });
  },
);

router.get(
  "/:id/nudges",
  requireUser,
  requireNonGuest,
  requireGroupOwner("id"),
  (req, res) => {
    const pending = nudges.get(req.params.id) || [];
    nudges.set(req.params.id, []);
    res.json(pending);
  },
);

export default router;
