import type { NextRequest } from "next/server";
import { requireGroupMember, requireUser } from "@/server/api/auth";
import { apiJson, handleApi, readJson } from "@/server/api/http";
import { openGroupLobby } from "@/server/lib/lobby.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser(request);
    const body = await readJson(request);
    const groupId = String(body?.groupId || "");
    await requireGroupMember(user.id, groupId);

    const { lobby } = await openGroupLobby({ groupId, user });
    return apiJson(lobby, 201);
  }, "Failed to create the lobby");
}
