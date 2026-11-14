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

    const [{ data: ratings }, { data: achievements }, { data: rivalries }, { data: members }] =
      await Promise.all([
        supabase
          .from("player_game_ratings")
          .select("*")
          .eq("group_id", groupId)
          .order("rating", { ascending: false }),
        supabase
          .from("group_achievements")
          .select("*")
          .eq("group_id", groupId)
          .order("earned_at", { ascending: false }),
        supabase
          .from("player_rivalries")
          .select("*")
          .eq("group_id", groupId)
          .order("games", { ascending: false })
          .limit(30),
        supabase
          .from("group_members")
          .select("user_id, profiles(display_name, avatar_url)")
          .eq("group_id", groupId),
      ]);

    return apiJson({
      ratings: ratings || [],
      achievements: achievements || [],
      rivalries: rivalries || [],
      members: (members || []).map(
        (member: {
          user_id: string;
          profiles:
            | { display_name: string; avatar_url: string | null }
            | { display_name: string; avatar_url: string | null }[]
            | null;
        }) => {
          const profile = Array.isArray(member.profiles)
            ? member.profiles[0]
            : member.profiles;
          return {
            userId: member.user_id,
            name: profile?.display_name || "Player",
            avatarUrl: profile?.avatar_url || null,
          };
        },
      ),
    });
  }, "Failed to fetch group progression");
}
