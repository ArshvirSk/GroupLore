import type { NextRequest } from "next/server";
import { requireHost, requireUser } from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi } from "@/server/api/http";
import { kickLobbyPlayer } from "@/server/lib/lobby.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const user = await requireUser(request);
    const lobby = await requireHost(user.id, id);
    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body?.userId || "");

    if (!targetUserId) {
      throw new ApiFailure(400, "user_required", "userId is required");
    }
    if (targetUserId === user.id) {
      throw new ApiFailure(400, "cannot_kick_self", "You cannot kick yourself");
    }

    await kickLobbyPlayer({ lobby, userId: targetUserId });
    return apiJson({ success: true });
  }, "Failed to kick that player");
}
