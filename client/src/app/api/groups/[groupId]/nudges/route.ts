import type { NextRequest } from "next/server";
import {
  requireGroupOwner,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { drainNudges } from "@/server/api/nudges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupOwner(user.id, groupId);
    return apiJson(drainNudges(groupId));
  }, "Failed to fetch nudges");
}
