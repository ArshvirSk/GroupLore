import type { NextRequest } from "next/server";
import { requireGroupMember, requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = await requireUser(request);
    await requireGroupMember(user.id, groupId);

    const { data } = await supabase
      .from("lobbies")
      .select("*, lobby_players(*)")
      .eq("group_id", groupId)
      .eq("status", "open")
      .maybeSingle();
    return apiJson(data || null);
  }, "Failed to fetch the active lobby");
}
