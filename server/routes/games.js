import { Router } from "express";
import { listGames } from "../games/index.js";
import { requireUser } from "../lib/auth.js";
import { notFound, serverError } from "../lib/http.js";
import {
  requireGroupMember,
  requireSessionMember,
} from "../lib/membership.js";
import { openGroupLobby } from "../lib/lobby.js";
import { supabase } from "../lib/supabase.js";

const router = Router();
router.use(requireUser);

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

// Compatibility endpoint for group rooms. New clients use POST /groups/:id/lobby.
router.get(
  "/active/:groupId",
  requireGroupMember("groupId"),
  async (req, res) => {
    try {
      const { data } = await supabase
        .from("lobbies")
        .select("*, lobby_players(*)")
        .eq("group_id", req.params.groupId)
        .eq("status", "open")
        .maybeSingle();
      res.json(data || null);
    } catch {
      res.json(null);
    }
  },
);

router.post("/", requireGroupMember("groupId"), async (req, res) => {
  try {
    const { lobby } = await openGroupLobby({
      groupId: req.body?.groupId,
      user: req.user,
    });
    res.status(201).json(lobby);
  } catch (err) {
    console.error("Create game lobby error:", err?.message || err);
    return serverError(res, "Failed to create the lobby");
  }
});

router.get("/:id", requireSessionMember, async (req, res) => {
  if (!req.gameSession) return notFound(res, "Session not found");
  res.json(req.gameSession);
});

export default router;
