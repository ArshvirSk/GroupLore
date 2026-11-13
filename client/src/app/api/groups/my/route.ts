import type { NextRequest } from "next/server";
import { requireNonGuest, requireUser } from "@/server/api/auth";
import { listGroupsForUser } from "@/server/api/groups";
import { apiJson, handleApi } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = requireNonGuest(await requireUser(request));
    return apiJson(await listGroupsForUser(user.id));
  }, "Failed to fetch groups");
}
