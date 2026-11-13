import type { NextRequest } from "next/server";
import { requireLobbyMember, requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { leaveLobby } from "@/server/lib/lobby.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const user = await requireUser(request);
    const { lobby } = await requireLobbyMember(user.id, id);
    const result = await leaveLobby({ lobby, userId: user.id });
    return apiJson({ success: true, ...result });
  }, "Failed to leave the lobby");
}
