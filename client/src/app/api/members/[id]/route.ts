import type { NextRequest } from "next/server";
import { requireNonGuest, requireUser } from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi } from "@/server/api/http";
import { isGroupMember, legacyUserId } from "@/server/lib/membership.js";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const user = requireNonGuest(await requireUser(request));

    const { data: profile } = await supabase
      .from("member_profiles")
      .select("id, group_id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (!profile) {
      throw new ApiFailure(404, "not_found", "Profile not found");
    }

    const membership = await isGroupMember(user.id, profile.group_id);
    if (!membership) {
      throw new ApiFailure(
        403,
        "not_group_member",
        "You are not in this group",
      );
    }

    const ownLegacyId = await legacyUserId(user.id);
    const isSelf = ownLegacyId && profile.user_id === ownLegacyId;
    if (!isSelf && membership.role !== "owner") {
      throw new ApiFailure(
        403,
        "owner_only",
        "Only the group owner can remove another member's profile",
      );
    }

    const { error } = await supabase
      .from("member_profiles")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return apiJson({ success: true });
  }, "Failed to delete member profile");
}
