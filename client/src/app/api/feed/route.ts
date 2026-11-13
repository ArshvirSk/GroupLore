import type { NextRequest } from "next/server";
import { requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser(request);
    const limit = Math.min(
      Number.parseInt(request.nextUrl.searchParams.get("limit") || "", 10) || 20,
      50,
    );
    const before =
      request.nextUrl.searchParams.get("before") || new Date().toISOString();

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);
    if (!memberships?.length) return apiJson([]);

    const groupIds = memberships.map(
      (membership: { group_id: string }) => membership.group_id,
    );
    const { data: activities, error } = await supabase
      .from("activity_log")
      .select("*, groups(name), profiles(display_name, avatar_url)")
      .in("group_id", groupIds)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return apiJson(activities || []);
  }, "Failed to fetch feed");
}
