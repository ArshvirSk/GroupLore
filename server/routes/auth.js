import { Router } from "express";
import { guestsAllowed } from "../lib/guestAccess.js";

const router = Router();

/**
 * Public auth configuration. The client uses this only to decide which entry
 * points to show; the server still rejects anonymous tokens when disabled.
 */
router.get("/config", (req, res) => {
  res.json({ guestsEnabled: guestsAllowed() });
});

/**
 * The old custom guest-token exchange is intentionally gone. Guests now use
 * Supabase Anonymous sign-in and receive a normal Supabase access token.
 */
router.post("/guest", (req, res) => {
  res.status(410).json({
    error: {
      code: "guest_endpoint_removed",
      message: "Use Supabase anonymous sign-in for guest play.",
    },
  });
});

export default router;
