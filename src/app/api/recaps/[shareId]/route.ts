import type { NextRequest } from "next/server";
import { ApiFailure, apiJson, handleApi } from "@/server/api/http";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  return handleApi(async () => {
    const { shareId } = await params;
    const { data, error } = await supabase
      .from("session_recaps")
      .select("share_id, game_type, mode, winner_name, winner_names, highlights, scores, created_at, groups(name)")
      .eq("share_id", shareId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiFailure(404, "recap_not_found", "That recap does not exist");
    return apiJson(data);
  }, "Failed to fetch the recap");
}
