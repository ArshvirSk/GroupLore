import type { NextRequest } from "next/server";
import { requireNonGuest, requireUser } from "@/server/api/auth";
import { leaveGroupForUser } from "@/server/api/groups";
import { apiJson, handleApi } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    return apiJson(await leaveGroupForUser(groupId, user));
  }, "Failed to leave group");
}
