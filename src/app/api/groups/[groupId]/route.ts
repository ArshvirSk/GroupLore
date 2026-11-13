import type { NextRequest } from "next/server";
import {
  requireGroupMember,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { getGroupDetail } from "@/server/api/groups";
import { apiJson, handleApi } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    const membership = await requireGroupMember(user.id, groupId);
    return apiJson(await getGroupDetail(groupId, membership.role));
  }, "Failed to fetch group");
}
