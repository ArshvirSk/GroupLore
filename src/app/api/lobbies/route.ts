import type { NextRequest } from "next/server";
import { requireNonGuest, requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { createQuickLobby } from "@/server/lib/lobby.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = requireNonGuest(await requireUser(request));
    return apiJson(await createQuickLobby({ user }), 201);
  }, "Failed to create a quick-play lobby");
}
