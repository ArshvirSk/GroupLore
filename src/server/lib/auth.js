import { guestsAllowed } from "./guestAccess.js";
import { supabase } from "./supabase.js";

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

function cleanName(value, fallback = "Player") {
  const name = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 60);
  return name || fallback;
}

export function displayNameFromUser(user) {
  const meta = user?.user_metadata || {};
  const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(" ");
  return cleanName(
    meta.display_name ||
      meta.full_name ||
      meta.name ||
      fullName ||
      user?.email?.split("@")[0] ||
      (user?.is_anonymous ? "Guest" : "Player"),
  );
}

export function avatarFromUser(user) {
  const meta = user?.user_metadata || {};
  return meta.avatar_url || meta.picture || null;
}

async function resolveRequestUser(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Ensure a profiles row exists for the verified auth user. Guest upgrade keeps
 * the same auth uid, so upgrading never creates a second profile.
 */
export async function ensureProfile(user) {
  const row = {
    id: user.id,
    display_name: displayNameFromUser(user),
    avatar_url: avatarFromUser(user),
    is_guest: Boolean(user.is_anonymous),
  };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Central HTTP auth. Attaches req.user = { id, isGuest, ... } using only the
 * verified token. ALLOW_GUESTS=false is enforced here, not just in the UI.
 */
export async function requireUser(req, res, next) {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      return res.status(401).json({
        error: { code: "unauthorized", message: "Sign in to play" },
      });
    }
    if (user.is_anonymous && !guestsAllowed()) {
      return res.status(403).json({
        error: {
          code: "guests_disabled",
          message: "Guest play is disabled. Sign in with an account to continue.",
        },
      });
    }

    const profile = await ensureProfile(user);
    req.authUser = user;
    req.user = {
      id: user.id,
      isGuest: Boolean(user.is_anonymous),
      email: user.email || null,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      profile,
    };
    return next();
  } catch (err) {
    console.error("Auth error:", err?.message || err);
    return res.status(401).json({
      error: { code: "unauthorized", message: "Could not verify your session" },
    });
  }
}

export async function optionalUser(req, res, next) {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      req.user = null;
      return next();
    }
    if (user.is_anonymous && !guestsAllowed()) {
      req.user = null;
      return next();
    }
    const profile = await ensureProfile(user);
    req.user = {
      id: user.id,
      isGuest: Boolean(user.is_anonymous),
      email: user.email || null,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      profile,
    };
  } catch {
    req.user = null;
  }
  return next();
}

export function requireNonGuest(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: { code: "unauthorized", message: "Sign in to play" },
    });
  }
  if (req.user.isGuest) {
    return res.status(403).json({
      error: {
        code: "guest_forbidden",
        message: "Create an account to use groups and quick play.",
      },
    });
  }
  return next();
}

// Backwards-compatible name used by older imports.
export const requireAuth = requireUser;
