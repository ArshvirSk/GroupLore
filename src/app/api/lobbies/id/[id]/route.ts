import type { NextRequest } from "next/server";
import { requireLobbyMember, requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const user = await requireUser(request);
    const { lobby } = await requireLobbyMember(user.id, id);
    return apiJson(lobby);
  }, "Failed to fetch that lobby");
}
