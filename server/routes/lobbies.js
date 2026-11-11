import { Router } from "express";
import { getGame } from "../games/index.js";
import { requireNonGuest, requireUser } from "../lib/auth.js";
import { fail, notFound, serverError } from "../lib/http.js";
import {
  createQuickLobby,
  findLobbyByCode,
  joinLobbyByCode,
  leaveLobby,
  kickLobbyPlayer,
  setLobbyStatus,
  normalizeCode,
  isValidCode,
} from "../lib/lobby.js";
import { requireHost, requireLobbyMember, loadLobby } from "../lib/membership.js";
import { joinLimiter } from "../lib/rateLimit.js";
import { supabase } from "../lib/supabase.js";

const router = Router();
router.use(requireUser);

// Quick play: non-guests may create a room with no group.
router.post("/", requireNonGuest, async (req, res) => {
  try {
    const lobby = await createQuickLobby({ user: req.user });
    return res.status(201).json(lobby);
  } catch (err) {
    console.error("Quick play error:", err?.message || err);
    return serverError(res, "Failed to create a quick-play lobby");
  }
});

router.post("/join", joinLimiter, async (req, res) => {
  const code = normalizeCode(req.body?.code);
  if (!isValidCode(code)) {
    return fail(res, 400, "invalid_code", "Enter a valid 6-character room code");
  }
  try {
    const lobby = await joinLobbyByCode({ code, user: req.user });
    if (!lobby) {
      return notFound(res, "That room code is not open");
    }
    return res.json(lobby);
  } catch (err) {
    console.error("Join lobby error:", err?.message || err);
    return serverError(res, "Failed to join that lobby");
  }
});

router.get("/id/:id", requireLobbyMember, (req, res) => {
  res.json(req.lobby);
});

router.get("/:code", async (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!isValidCode(code)) {
    return fail(res, 400, "invalid_code", "Enter a valid 6-character room code");
  }
  try {
    const found = await findLobbyByCode(code);
    if (!found || found.status === "closed") {
      return notFound(res, "That room code is not open");
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
    return res.json({ ...lobby, active_session_id: session?.id || null });
  } catch (err) {
    console.error("Get lobby error:", err?.message || err);
    return serverError(res, "Failed to fetch that lobby");
  }
});

router.post("/:id/leave", requireLobbyMember, async (req, res) => {
  try {
    const result = await leaveLobby({ lobby: req.lobby, userId: req.user.id });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("Leave lobby error:", err?.message || err);
    return serverError(res, "Failed to leave the lobby");
  }
});

router.post("/:id/kick", requireHost, async (req, res) => {
  const targetUserId = String(req.body?.userId || "");
  if (!targetUserId) {
    return fail(res, 400, "user_required", "userId is required");
  }
  if (targetUserId === req.user.id) {
    return fail(res, 400, "cannot_kick_self", "You cannot kick yourself");
  }
  try {
    await kickLobbyPlayer({ lobby: req.lobby, userId: targetUserId });
    return res.json({ success: true });
  } catch (err) {
    console.error("Kick error:", err?.message || err);
    return serverError(res, "Failed to kick that player");
  }
});

// Host-only start. It creates the session; the socket host then starts the
// selected game with the normal engine action.
router.post("/:id/start", requireHost, async (req, res) => {
  if (req.lobby.status !== "open") {
    return fail(res, 409, "lobby_not_open", "This lobby has already started");
  }
  const game = getGame(String(req.body?.gameId || ""));
  if (!game) return notFound(res, "That game does not exist");
  const mode = String(req.body?.mode || "classic");
  if (!game.modes[mode]) return fail(res, 400, "unknown_mode", "Unknown mode");

  const connected = (req.lobby.lobby_players || []).filter(
    (player) => player.connected,
  );
  if (connected.length < game.minPlayers) {
    return fail(
      res,
      409,
      "not_enough_players",
      `${game.name} needs at least ${game.minPlayers} connected players`,
    );
  }
  if (connected.length > game.maxPlayers) {
    return fail(
      res,
      409,
      "too_many_players",
      `${game.name} allows at most ${game.maxPlayers} players`,
    );
  }

  try {
    const { data: session, error } = await supabase
      .from("game_sessions")
      .insert({
        lobby_id: req.lobby.id,
        game_type: game.id,
        status: "lobby",
        current_round: 0,
        round_data: {},
        scores: {},
      })
      .select("*")
      .single();
    if (error) throw error;

    await setLobbyStatus(req.lobby.id, "in_game");
    return res.status(201).json({
      sessionId: session.id,
      lobby: await loadLobby(req.lobby.id),
    });
  } catch (err) {
    console.error("Start lobby error:", err?.message || err);
    return serverError(res, "Failed to start the game");
  }
});

export default router;
