import type { NextRequest } from "next/server";
import { requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser(request);
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);
    if (!memberships?.length) return apiJson([]);

    const { data: lobbies, error } = await supabase
      .from("lobbies")
      .select("*, groups(name), lobby_players(*)")
      .in(
        "group_id",
        memberships.map(
          (membership: { group_id: string }) => membership.group_id,
        ),
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return apiJson(lobbies || []);
  }, "Failed to fetch active lobbies");
}
