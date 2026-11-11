import { Router } from "express";
import { computeBadges } from "../lib/activity.js";
import { requireAuth } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

async function resolveUserId(authUserId) {
    const { data } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .single();
    return data?.id || null;
}

/**
 * GET /api/feed
 * Returns the lore feed for the current user — activities across all their groups.
 * Query params: ?limit=20&before=<ISO timestamp>
 */
router.get("/", requireAuth, async (req, res) => {
    try {
        const dbUserId = await resolveUserId(req.authUserId);
        if (!dbUserId) return res.json([]);

        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const before = req.query.before || new Date().toISOString();

        // Get all groups the user belongs to
        const { data: memberships } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", dbUserId);

        if (!memberships || memberships.length === 0) return res.json([]);

        const groupIds = memberships.map((m) => m.group_id);

        // Fetch activities across all groups
        const { data: activities, error } = await supabase
            .from("activity_log")
            .select("*, groups(name), users(name, avatar_url)")
            .in("group_id", groupIds)
            .lt("created_at", before)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json(activities || []);
    } catch (err) {
        console.error("Feed error:", err);
        res.status(500).json({ error: "Failed to fetch feed" });
    }
});

/**
 * GET /api/feed/stats
 * Returns the current user's player stats + computed reputation badges.
 */
router.get("/stats", requireAuth, async (req, res) => {
    try {
        const dbUserId = await resolveUserId(req.authUserId);
        if (!dbUserId) return res.json({ stats: null, badges: [] });

        const { data: stats } = await supabase
            .from("player_stats")
            .select("*")
            .eq("user_id", dbUserId)
            .single();

        const badges = computeBadges(stats);

        // Cross-group personality: gather traits from all groups
        const { data: profiles } = await supabase
            .from("member_profiles")
            .select("group_id, traits, display_name, groups(name)")
            .eq("user_id", dbUserId);

        const personalityByGroup = (profiles || []).map((p) => ({
            groupName: p.groups?.name || "Unknown",
            displayName: p.display_name,
            traits: p.traits || [],
        }));

        res.json({
            stats: stats || { games_played: 0, games_won: 0 },
            badges,
            personalityByGroup,
        });
    } catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

/**
 * GET /api/feed/active-lobbies
 * Returns all active lobby sessions across the user's groups — for Quick Play.
 */
router.get("/active-lobbies", requireAuth, async (req, res) => {
    try {
        const dbUserId = await resolveUserId(req.authUserId);
        if (!dbUserId) return res.json([]);

        // Get all groups the user belongs to
        const { data: memberships } = await supabase
            .from("group_members")
            .select("group_id")
            .eq("user_id", dbUserId);

        if (!memberships || memberships.length === 0) return res.json([]);

        const groupIds = memberships.map((m) => m.group_id);

        // Find active lobby sessions across all groups
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        const { data: lobbies, error } = await supabase
            .from("game_sessions")
            .select("*, groups(name)")
            .in("group_id", groupIds)
            .eq("status", "lobby")
            .gt("created_at", thirtyMinAgo)
            .order("created_at", { ascending: false });

        if (error) throw error;

        res.json(lobbies || []);
    } catch (err) {
        console.error("Active lobbies error:", err);
        res.status(500).json({ error: "Failed to fetch active lobbies" });
    }
});

export default router;
