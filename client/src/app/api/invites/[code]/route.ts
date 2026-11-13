import { apiJson, handleApi, ApiFailure } from "@/server/api/http";
import { guestsAllowed } from "@/server/lib/guestAccess.js";
import { isValidCode, normalizeCode } from "@/server/lib/lobby.js";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  return handleApi(async () => {
    const { code: rawCode } = await params;
    const code = normalizeCode(rawCode);
    if (!isValidCode(code)) {
      throw new ApiFailure(400, "invalid_code", "Enter a valid 6-character code");
    }

    const { data: lobby, error } = await supabase
      .from("lobbies")
      .select("id, code, status, group_id, groups(id, name)")
      .eq("code", code)
      .neq("status", "closed")
      .maybeSingle();
    if (error) throw error;
    if (!lobby) {
      throw new ApiFailure(404, "not_found", "That invite code does not exist");
    }

    return apiJson({
      lobby: {
        id: lobby.id,
        code: lobby.code,
        status: lobby.status,
        group_id: lobby.group_id,
      },
      group: lobby.groups || null,
      guestsEnabled: guestsAllowed(),
    });
  }, "Could not look up this invite");
}
