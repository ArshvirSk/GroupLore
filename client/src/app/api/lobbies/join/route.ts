import type { NextRequest } from "next/server";
import { requireUser } from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi, readJson } from "@/server/api/http";
import { enforceJoinLimit } from "@/server/api/rateLimit";
import { isValidCode, joinLobbyByCode, normalizeCode } from "@/server/lib/lobby.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser(request);
    enforceJoinLimit(request, user.id);

    const body = await readJson(request);
    const code = normalizeCode(body?.code);
    if (!isValidCode(code)) {
      throw new ApiFailure(400, "invalid_code", "Enter a valid 6-character room code");
    }

    const lobby = await joinLobbyByCode({ code, user });
    if (!lobby) {
      throw new ApiFailure(404, "not_found", "That room code is not open");
    }
    return apiJson(lobby);
  }, "Failed to join that lobby");
}
