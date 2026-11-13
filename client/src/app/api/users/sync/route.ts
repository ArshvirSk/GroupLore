import type { NextRequest } from "next/server";
import { requireUser, type ApiUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function payload(user: ApiUser) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isGuest: user.isGuest,
    email: user.email,
  };
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser(request);
    return apiJson(payload(user));
  }, "Could not sync your profile");
}
