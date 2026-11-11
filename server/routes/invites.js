import { Router } from "express";
import { guestsAllowed } from "../lib/guestAccess.js";
import { fail, notFound, serverError } from "../lib/http.js";
import { isValidCode, normalizeCode } from "../lib/lobby.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

/**
 * Public invite lookup by room code. It exposes the room name and group name,
 * never members or history.
 */
router.get("/:code", async (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!isValidCode(code)) {
    return fail(res, 400, "invalid_code", "Enter a valid 6-character code");
  }

  try {
    const { data: lobby, error } = await supabase
      .from("lobbies")
      .select("id, code, status, group_id, groups(id, name)")
      .eq("code", code)
      .neq("status", "closed")
      .maybeSingle();
    if (error) throw error;
    if (!lobby) return notFound(res, "That invite code does not exist");

    return res.json({
      lobby: {
        id: lobby.id,
        code: lobby.code,
        status: lobby.status,
        group_id: lobby.group_id,
      },
      group: lobby.groups || null,
      guestsEnabled: guestsAllowed(),
    });
  } catch (err) {
    console.error("Invite lookup error:", err?.message || err);
    return serverError(res, "Could not look up this invite");
  }
});

export default router;
