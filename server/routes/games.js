import { Router } from "express";
import { listGames } from "../games/index.js";
import { requireAuth } from "../lib/auth.js";
import {
  requireGroupMember,
  requireSessionMember,
} from "../lib/membership.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

router.use(requireAuth);

// ── Helper: clean up all stale sessions for a group ──
async function cleanupStaleSessions(groupId) {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  await supabase
    .from("game_sessions")
    .update({ status: "finished" })
    .eq("group_id", groupId)
    .eq("status", "lobby")
    .lt("created_at", thirtyMinAgo);

  await supabase
    .from("game_sessions")
    .update({ status: "finished" })
    .eq("group_id", groupId)
    .eq("status", "active")
    .lt("created_at", oneHourAgo);
}

// Public game catalogue metadata (id, name, modes, player limits).
router.get("/catalog", (req, res) => {
  res.json(
    listGames().map((game) => ({
      id: game.id,
      name: game.name,
      description: game.description,
      emoji: game.emoji || "🎮",
      accent: game.accent || "grape",
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      modes: Object.entries(game.modes).map(([id, config]) => ({
        id,
        label: config.label || id,
        description: config.description || "",
      })),
    })),
  );
});

// Check for an open lobby session (read-only, no creation).
router.get("/active/:groupId", requireGroupMember("groupId"), async (req, res) => {
  try {
    await cleanupStaleSessions(req.params.groupId);

    const { data } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("group_id", req.params.groupId)
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json(data || null);
  } catch {
    res.json(null);
  }
});

// Find or create a lobby session for a group the caller belongs to.
router.post("/", requireGroupMember("groupId"), async (req, res) => {
  try {
    const { groupId } = req.body;

    await cleanupStaleSessions(groupId);

    const { data: existing } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return res.json(existing);
    }

    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        group_id: groupId,
        game_type: "most-likely-to",
        status: "lobby",
        current_round: 0,
        round_data: {},
        scores: {},
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error("Create game session error:", err);
    res.status(500).json({ error: "Failed to create game session" });
  }
});

// Get a single session (members only).
router.get("/:id", requireSessionMember, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Get game session error:", err);
    res.status(500).json({ error: "Failed to fetch game session" });
  }
});

export default router;
