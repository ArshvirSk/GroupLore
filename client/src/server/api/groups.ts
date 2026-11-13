import { logActivity } from "../lib/activity.js";
import { ensureLegacyUser } from "../lib/membership.js";
import { openGroupLobby } from "../lib/lobby.js";
import { supabase } from "../lib/supabase.js";
import { ApiFailure } from "./http";
import type { ApiUser } from "./auth";

export function cleanGroupName(value: unknown) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 60);
}

async function openLobbiesFor(groupIds: string[]) {
  if (groupIds.length === 0) return new Map();
  const { data } = await supabase
    .from("lobbies")
    .select("*, lobby_players(*)")
    .in("group_id", groupIds)
    .eq("status", "open");
  return new Map(
    (data || []).map((lobby: { group_id: string }) => [lobby.group_id, lobby]),
  );
}

export async function createGroupForUser(user: ApiUser, name: string) {
  await ensureLegacyUser(user);
  const { data: group, error } = await supabase
    .from("groups")
    .insert({ name, owner_id: user.id })
    .select("*")
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "owner" });
  if (memberError) {
    await supabase.from("groups").delete().eq("id", group.id);
    throw memberError;
  }

  void logActivity({
    groupId: group.id,
    userId: user.id,
    eventType: "member_joined",
    payload: { displayName: user.displayName },
  });

  return { ...group, role: "owner", lobby: null };
}

export async function listGroupsForUser(userId: string) {
  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("group_id, role, joined_at, groups(*)")
    .eq("user_id", userId);
  if (error) throw error;

  type GroupRecord = { id: string; [key: string]: unknown };
  type MembershipRow = {
    groups: GroupRecord | null;
    role: string;
    joined_at: string;
  };
  const rows = (memberships || []) as unknown as MembershipRow[];
  const groups: GroupRecord[] = rows.flatMap((membership) =>
    membership.groups
      ? [
          {
            ...membership.groups,
            role: membership.role,
            joined_at: membership.joined_at,
          },
        ]
      : [],
  );

  const lobbies = await openLobbiesFor(groups.map((group) => group.id));
  return groups.map((group) => ({
    ...group,
    lobby: lobbies.get(group.id) || null,
  }));
}

export async function getGroupDetail(groupId: string, role: string) {
  const { data: group, error } = await supabase
    .from("groups")
    .select(
      "*, group_members(role, joined_at, profiles(id, display_name, avatar_url, is_guest))",
    )
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!group) {
    throw new ApiFailure(404, "not_found", "Group not found");
  }

  const { data: lobby } = await supabase
    .from("lobbies")
    .select("*, lobby_players(*)")
    .eq("group_id", group.id)
    .eq("status", "open")
    .maybeSingle();

  return {
    ...group,
    role,
    members: (group.group_members || []).map(
      (member: {
        profiles: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          is_guest: boolean;
        } | null;
        role: string;
        joined_at: string;
      }) => ({
        ...member.profiles,
        id: member.profiles?.id,
        user_id: member.profiles?.id,
        role: member.role,
        joined_at: member.joined_at,
      }),
    ),
    lobby: lobby || null,
  };
}

export async function openLobbyForGroup(groupId: string, user: ApiUser) {
  return openGroupLobby({ groupId, user });
}

export async function leaveGroupForUser(groupId: string, user: ApiUser) {
  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    throw new ApiFailure(403, "not_group_member", "You are not in this group");
  }

  const { data: remaining } = await supabase
    .from("group_members")
    .select("user_id, role, joined_at")
    .eq("group_id", groupId)
    .neq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (!remaining || remaining.length === 0) {
    await supabase.from("groups").delete().eq("id", groupId);
    return { success: true, groupDeleted: true };
  }

  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (membership.role === "owner") {
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

  void logActivity({
    groupId,
    userId: user.id,
    eventType: "member_left",
    payload: {},
  });
  return { success: true, groupDeleted: false };
}

export async function removeGroupMember(groupId: string, targetUserId: string) {
  const { data: target } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!target) {
    throw new ApiFailure(404, "not_found", "That member is not in this group");
  }

  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", targetUserId);
  return { success: true };
}
