import { createClerkClient } from "@clerk/express";
import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

const router = Router();

const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * POST /api/users/sync
 * Called once per session. Resolves the Clerk user to a Supabase `users` row.
 * Creates the row if it doesn't exist, updates name/email/avatar if it does.
 */
router.post("/sync", requireAuth, async (req, res) => {
    try {
        const clerkUserId = req.clerkUserId;

        // Fetch full user profile from Clerk
        const clerkUser = await clerkClient.users.getUser(clerkUserId);

        const displayName =
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
            clerkUser.username ||
            "User";
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
        const avatarUrl = clerkUser.imageUrl || null;

        // Upsert into Supabase users table
        const { data: existing } = await supabase
            .from("users")
            .select("id")
            .eq("clerk_id", clerkUserId)
            .single();

        let dbUserId;

        if (existing) {
            // Update profile fields in case they changed
            await supabase
                .from("users")
                .update({ name: displayName, email, avatar_url: avatarUrl })
                .eq("id", existing.id);
            dbUserId = existing.id;
        } else {
            const { data: newUser, error } = await supabase
                .from("users")
                .insert({
                    clerk_id: clerkUserId,
                    name: displayName,
                    email,
                    avatar_url: avatarUrl,
                })
                .select("id")
                .single();

            if (error) throw error;
            dbUserId = newUser.id;
        }

        res.json({ dbUserId, displayName, avatarUrl });
    } catch (err) {
        console.error("User sync error:", err);
        res.status(500).json({ error: "Failed to sync user" });
    }
});

/**
 * GET /api/users/me
 * Returns the current user's Supabase profile.
 */
router.get("/me", requireAuth, async (req, res) => {
    try {
        const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("clerk_id", req.clerkUserId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: "User not found — sync first" });
        }

        res.json(user);
    } catch (err) {
        console.error("Get user error:", err);
        res.status(500).json({ error: "Failed to get user" });
    }
});

export default router;
