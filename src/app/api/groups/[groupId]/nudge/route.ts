import type { NextRequest } from "next/server";
import {
  requireGroupMember,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { addNudge } from "@/server/api/nudges";

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
    return apiJson(addNudge(groupId, user.displayName));
  }, "Failed to send nudge");
}
