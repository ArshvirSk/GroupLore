import { randomUUID } from "node:crypto";
import { Router } from "express";
import { cleanName, signGuestToken } from "../engine/auth.js";

const router = Router();

/**
 * POST /api/auth/guest
 * Exchanges a display name for a signed guest identity.
 * Guests are only accepted by the socket layer when ALLOW_GUESTS is enabled.
 */
router.post("/guest", (req, res) => {
  if (process.env.ALLOW_GUESTS === "false") {
    return res.status(403).json({ error: "Guest play is disabled" });
  }

  const name = cleanName(req.body?.name, "Guest");
  const guestId = randomUUID();

  res.json({
    guestId,
    name,
    guestToken: signGuestToken({ guestId, name }),
  });
});

export default router;
