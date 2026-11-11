import { supabase } from "./supabase.js";

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

async function resolveRequestUser(req) {
  const token = bearerToken(req);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Express middleware: requires a valid Supabase Auth session.
 * Attaches `req.authUserId` (the Supabase auth user UUID) and `req.authUser`.
 */
export async function requireAuth(req, res, next) {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized — please sign in" });
    }
    req.authUserId = user.id;
    req.authUser = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized — please sign in" });
  }
}

/**
 * Express middleware: optionally attaches the Supabase auth user.
 * Does NOT block unauthenticated requests (useful for public endpoints).
 */
export async function optionalAuth(req, res, next) {
  try {
    const user = await resolveRequestUser(req);
    req.authUserId = user?.id || null;
    req.authUser = user || null;
  } catch {
    req.authUserId = null;
    req.authUser = null;
  }
  return next();
}
