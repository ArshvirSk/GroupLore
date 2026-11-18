import type { NextRequest } from "next/server";
import { requireGroupMember, requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { listGames } from "@/server/games/index.js";
import { dailyKey } from "@/server/lib/daily.js";
import { summarizeDailyProgress } from "@/server/lib/dailyProgress.js";
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

    const { data: finishes, error } = await supabase
      .from("activity_log")
      .select("payload, created_at")
      .eq("group_id", groupId)
      .eq("event_type", "game_finished")
      .contains("payload", { gameMode: "daily" })
      .order("created_at", { ascending: false });
    if (error) throw error;

    const today = dailyKey();
    const progress = summarizeDailyProgress(
      (finishes || [])
        .filter((row) => row.payload?.reason === "completed")
        .map((row) => ({
          game_type: row.payload?.gameType || null,
          daily_date: row.payload?.dailyDate || null,
          created_at: row.created_at,
        })),
      today,
    );
    const games = listGames()
      .filter((game) => game.modes?.daily)
      .map((game) => ({
        id: game.id,
        name: game.name,
        description: game.modes.daily.description || "",
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        completed: progress.completedGames.has(game.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return apiJson({
      today,
      streak: progress.streak,
      games,
    });
  }, "Failed to load the group daily challenge");
}
