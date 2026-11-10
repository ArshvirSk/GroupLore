import { getAuth } from "@clerk/express";

/**
 * Express middleware: requires a valid Clerk session.
 * Attaches `req.clerkUserId` (the Clerk user ID string) for downstream use.
 */
export function requireAuth(req, res, next) {
    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized — please sign in" });
    }
    req.clerkUserId = userId;
    next();
}

/**
 * Express middleware: optionally attaches Clerk userId if present.
 * Does NOT block unauthenticated requests (useful for public endpoints).
 */
export function optionalAuth(req, res, next) {
    const { userId } = getAuth(req);
    req.clerkUserId = userId || null;
    next();
}
