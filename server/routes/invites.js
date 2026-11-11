import { Router } from "express";
import { guestsAllowed } from "../lib/guestAccess.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

/**
 * GET /api/invites/:code
 *
 * The six-character join code is the bearer secret for this lookup. It exposes
 * only the group name and its currently open lobby, never members or history.
 */
router.get("/:code", async (req, res) => {
  const code = String(req.params.code || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter a valid 6-character code" });
  }

  try {
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id, name")
      .eq("join_code", code)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!group) {
      return res.status(404).json({ error: "That invite code does not exist" });
    }

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabase
      .from("game_sessions")
      .update({ status: "finished" })
      .eq("group_id", group.id)
      .eq("status", "lobby")
      .lt("created_at", thirtyMinAgo);

    const { data: lobby, error: lobbyError } = await supabase
      .from("game_sessions")
      .select("id, game_type, created_at")
      .eq("group_id", group.id)
      .eq("status", "lobby")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lobbyError) throw lobbyError;

    return res.json({
      group,
      lobby: lobby || null,
      guestsEnabled: guestsAllowed(),
    });
  } catch (err) {
    console.error("Invite lookup error:", err);
    return res.status(500).json({ error: "Could not look up this invite" });
  }
});

export default router;
