import type { NextRequest } from "next/server";
import {
  requireGroupMember,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi } from "@/server/api/http";
import {
  ensureLegacyUser,
  isGroupMember,
  legacyUserId,
} from "@/server/lib/membership.js";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 160))
    .filter(Boolean)
    .slice(0, 20);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupMember(user.id, groupId);

    const { data, error } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("group_id", groupId);
    if (error) throw error;
    return apiJson(data || []);
  }, "Failed to fetch members");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    const membership = await requireGroupMember(user.id, groupId);
    const body = await request.json().catch(() => ({}));

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
    } = body || {};

    if (!displayName || typeof displayName !== "string") {
      throw new ApiFailure(
        400,
        "display_name_required",
        "displayName is required",
      );
    }

    const targetAuthId = requestedUserId || user.id;
    if (targetAuthId !== user.id) {
      const targetMembership = await isGroupMember(targetAuthId, groupId);
      if (!targetMembership) {
        throw new ApiFailure(
          400,
          "not_group_member",
          "That user is not in this group",
        );
      }
      if (membership.role !== "owner") {
        throw new ApiFailure(
          403,
          "owner_only",
          "Only the group owner can edit another member's profile",
        );
      }
    }

    const targetUserId =
      targetAuthId === user.id
        ? await ensureLegacyUser(user)
        : await legacyUserId(targetAuthId);
    if (!targetUserId) {
      throw new ApiFailure(
        400,
        "user_not_found",
        "That user has no legacy profile row",
      );
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
      nickname:
        typeof nickname === "string" ? nickname.trim().slice(0, 60) : null,
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
      return apiJson(data);
    }

    const { data, error } = await supabase
      .from("member_profiles")
      .insert(profileData)
      .select()
      .single();
    if (error) throw error;
    return apiJson(data, 201);
  }, "Failed to save member profile");
}
