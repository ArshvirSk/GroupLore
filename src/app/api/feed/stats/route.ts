import type { NextRequest } from "next/server";
import { requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { computeBadges } from "@/server/lib/activity.js";
import { legacyUserId } from "@/server/lib/membership.js";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireUser(request);
    const { data: stats } = await supabase
      .from("player_stats")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const legacyId = await legacyUserId(user.id);
    let personalityByGroup: Array<{
      groupName: string;
      displayName: string;
      traits: string[];
    }> = [];

    if (legacyId) {
      const { data: profiles } = await supabase
        .from("member_profiles")
        .select("group_id, traits, display_name, groups(name)")
        .eq("user_id", legacyId);
      personalityByGroup = (profiles || []).map((profile) => {
        const row = profile as unknown as {
          groups?: { name?: string } | Array<{ name?: string }> | null;
          display_name: string;
          traits?: string[];
        };
        const groupValue = row.groups;
        const groupName = Array.isArray(groupValue)
          ? groupValue[0]?.name
          : groupValue?.name;
        return {
          groupName: groupName || "Unknown",
          displayName: row.display_name,
          traits: row.traits || [],
        };
      });
    }

    return apiJson({
      stats: stats || { games_played: 0, games_won: 0 },
      badges: computeBadges(stats),
      personalityByGroup,
    });
  }, "Failed to fetch stats");
}
