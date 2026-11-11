import { Router } from "express";
import { computeBadges } from "../lib/activity.js";
import { requireUser } from "../lib/auth.js";
import { serverError } from "../lib/http.js";
import { legacyUserId } from "../lib/membership.js";
import { supabase } from "../lib/supabase.js";

const router = Router();
router.use(requireUser);

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const before = req.query.before || new Date().toISOString();

    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", req.user.id);
    if (!memberships?.length) return res.json([]);

    const groupIds = memberships.map((membership) => membership.group_id);
    const { data: activities, error } = await supabase
      .from("activity_log")
      .select("*, groups(name), profiles(display_name, avatar_url)")
      .in("group_id", groupIds)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return res.json(activities || []);
  } catch (err) {
    console.error("Feed error:", err?.message || err);
    return serverError(res, "Failed to fetch feed");
  }
});

router.get("/stats", async (req, res) => {
  try {
    const { data: stats } = await supabase
      .from("player_stats")
      .select("*")
      .eq("user_id", req.user.id)
      .maybeSingle();

    const legacyId = await legacyUserId(req.user.id);
    let personalityByGroup = [];
    if (legacyId) {
      const { data: profiles } = await supabase
        .from("member_profiles")
        .select("group_id, traits, display_name, groups(name)")
        .eq("user_id", legacyId);
      personalityByGroup = (profiles || []).map((profile) => ({
        groupName: profile.groups?.name || "Unknown",
        displayName: profile.display_name,
        traits: profile.traits || [],
      }));
    }

    return res.json({
      stats: stats || { games_played: 0, games_won: 0 },
      badges: computeBadges(stats),
      personalityByGroup,
    });
  } catch (err) {
    console.error("Stats error:", err?.message || err);
    return serverError(res, "Failed to fetch stats");
  }
});

router.get("/active-lobbies", async (req, res) => {
  try {
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", req.user.id);
    if (!memberships?.length) return res.json([]);

    const { data: lobbies, error } = await supabase
      .from("lobbies")
      .select("*, groups(name), lobby_players(*)")
      .in(
        "group_id",
        memberships.map((membership) => membership.group_id),
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json(lobbies || []);
  } catch (err) {
    console.error("Active lobbies error:", err?.message || err);
    return serverError(res, "Failed to fetch active lobbies");
  }
});

export default router;
