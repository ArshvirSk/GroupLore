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
    const { data, error } = await supabase
      .from("session_recaps")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return apiJson(data || []);
  }, "Failed to fetch recaps");
}
