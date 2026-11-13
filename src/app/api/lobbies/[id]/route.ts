import type { NextRequest } from "next/server";
import { requireUser } from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi } from "@/server/api/http";
import {
  findLobbyByCode,
  isValidCode,
  normalizeCode,
} from "@/server/lib/lobby.js";
import { loadLobby } from "@/server/lib/membership.js";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    await requireUser(request);
    const { id } = await params;
    const code = normalizeCode(id);
    if (!isValidCode(code)) {
      throw new ApiFailure(400, "invalid_code", "Enter a valid 6-character code");
    }

    const found = await findLobbyByCode(code);
    if (!found || found.status === "closed") {
      throw new ApiFailure(404, "not_found", "That room code is not open");
    }

    const lobby = await loadLobby(found.id);
    const { data: session } = await supabase
      .from("game_sessions")
      .select("id")
      .eq("lobby_id", lobby.id)
      .neq("status", "finished")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return apiJson({ ...lobby, active_session_id: session?.id || null });
  }, "Failed to fetch that lobby");
}
