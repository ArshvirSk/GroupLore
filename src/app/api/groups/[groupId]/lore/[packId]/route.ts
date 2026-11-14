import type { NextRequest } from "next/server";
import {
  requireGroupOwner,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi, readJson } from "@/server/api/http";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; packId: string }> },
) {
  return handleApi(async () => {
    const { groupId, packId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupOwner(user.id, groupId);
    const body = await readJson(request);
    if (body?.status !== "approved") {
      throw new ApiFailure(400, "invalid_status", "Only approval is supported");
    }

    const { data: pack } = await supabase
      .from("lore_packs")
      .select("id, group_id")
      .eq("id", packId)
      .eq("group_id", groupId)
      .maybeSingle();
    if (!pack) throw new ApiFailure(404, "not_found", "Lore pack not found");

    await supabase
      .from("lore_packs")
      .update({ status: "archived" })
      .eq("group_id", groupId)
      .eq("status", "approved");

    const { data, error } = await supabase
      .from("lore_packs")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", packId)
      .select()
      .single();
    if (error) throw error;
    return apiJson(data);
  }, "Failed to approve the lore pack");
}
