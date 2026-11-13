import type { NextRequest } from "next/server";
import {
  requireGroupMember,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { openLobbyForGroup } from "@/server/api/groups";
import { apiJson, handleApi } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupMember(user.id, groupId);
    const { lobby, created } = await openLobbyForGroup(groupId, user);
    return apiJson(lobby, created ? 201 : 200);
  }, "Failed to open the group lobby");
}
