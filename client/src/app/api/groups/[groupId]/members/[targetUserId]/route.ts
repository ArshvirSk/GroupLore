import type { NextRequest } from "next/server";
import {
  requireGroupOwner,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { removeGroupMember } from "@/server/api/groups";
import { ApiFailure, apiJson, handleApi } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ groupId: string; targetUserId: string }> },
) {
  return handleApi(async () => {
    const { groupId, targetUserId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupOwner(user.id, groupId);

    if (targetUserId === user.id) {
      throw new ApiFailure(
        400,
        "cannot_remove_self",
        "Use leave group to remove yourself",
      );
    }

    return apiJson(await removeGroupMember(groupId, targetUserId));
  }, "Failed to remove member");
}
