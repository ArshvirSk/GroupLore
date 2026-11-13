import type { NextRequest } from "next/server";
import { requireNonGuest, requireUser } from "@/server/api/auth";
import {
  cleanGroupName,
  createGroupForUser,
  listGroupsForUser,
} from "@/server/api/groups";
import { ApiFailure, apiJson, handleApi, readJson } from "@/server/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = requireNonGuest(await requireUser(request));
    return apiJson(await listGroupsForUser(user.id));
  }, "Failed to fetch groups");
}

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = requireNonGuest(await requireUser(request));
    const body = await readJson(request);
    const name = cleanGroupName(body?.name);
    if (!name) {
      throw new ApiFailure(400, "name_required", "Group name is required");
    }
    return apiJson(await createGroupForUser(user, name), 201);
  }, "Failed to create group");
}
