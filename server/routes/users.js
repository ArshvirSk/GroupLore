import { Router } from "express";
import { requireUser } from "../lib/auth.js";

const router = Router();

function payload(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isGuest: user.isGuest,
    email: user.email,
  };
}

/** Called after token refresh; the central middleware already ensures the row. */
router.post("/sync", requireUser, (req, res) => {
  res.json(payload(req.user));
});

router.get("/me", requireUser, (req, res) => {
  res.json(payload(req.user));
});

export default router;
