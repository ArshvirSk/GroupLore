import { Router } from "express";
import { supabase } from "../lib/supabase.js";

const router = Router();

// ── Helper: clean up all stale sessions for a group ──
async function cleanupStaleSessions(groupId) {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Mark stale "lobby" sessions (>30 min) as finished
  await supabase
    .from("game_sessions")
    .update({ status: "finished" })
    .eq("group_id", groupId)
    .eq("status", "lobby")
    .lt("created_at", thirtyMinAgo);

  // Mark stale "active" sessions (>1 hour) as finished
  await supabase
    .from("game_sessions")
    .update({ status: "finished" })
    .eq("group_id", groupId)
    .eq("status", "active")
    .lt("created_at", oneHourAgo);
}

// Check for active lobby session (read-only, no creation)
// Only returns "lobby" sessions — NOT "active" (in-progress) games
router.get("/active/:groupId", async (req, res) => {
  try {
    // Clean up stale sessions first
    await cleanupStaleSessions(req.params.groupId);

    const { data } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("group_id", req.params.groupId)
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    res.json(data || null);
  } catch {
    res.json(null);
  }
});

// Find or create a game session for a group
router.post("/", async (req, res) => {
  try {
    const { groupId, gameType } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: "groupId required" });
    }

    // Clean up stale sessions first
    await cleanupStaleSessions(groupId);

    // Check for an existing lobby session for this group
    const { data: existing } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      return res.json(existing);
    }

    // No active lobby — create a new session
    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        group_id: groupId,
        game_type: gameType || "overrated-underrated",
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

// Get game session
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Session not found" });

    res.json(data);
  } catch (err) {
    console.error("Get game session error:", err);
    res.status(500).json({ error: "Failed to fetch game session" });
  }
});

// Update game session
router.patch("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("game_sessions")
      .update(req.body)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Update game session error:", err);
    res.status(500).json({ error: "Failed to update game session" });
  }
});

export default router;
