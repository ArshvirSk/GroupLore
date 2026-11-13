import type { NextRequest } from "next/server";
import { requireSessionMember, requireUser } from "@/server/api/auth";
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
    return apiJson(await requireSessionMember(user.id, id));
  }, "Failed to fetch the game session");
}
