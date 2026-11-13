import crypto from "node:crypto";

/**
 * Identity + reconnect helpers.
 *
 * The only identity source is a verified Supabase access token. Anonymous
 * Supabase users are guests; there is no custom guest-token branch.
 */

const DEFAULT_DEV_SECRET = "grouplore-local-dev-secret-do-not-use-in-production";

export function tokenSecret() {
  return process.env.SESSION_SECRET || DEFAULT_DEV_SECRET;
}

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

export function signToken(payload, ttlMs, secret = tokenSecret()) {
  const body = b64url(
    JSON.stringify({ ...payload, exp: Date.now() + ttlMs }),
  );
  return `${body}.${sign(body, secret)}`;
}

export function verifySignedToken(token, secret = tokenSecret()) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signReconnectToken({ sessionId, playerId }, ttlMs = 24 * 60 * 60 * 1000) {
  return signToken({ kind: "reconnect", sid: sessionId, pid: playerId }, ttlMs);
}

export function cleanName(value, fallback = "Player") {
  const name = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 24);
  return name || fallback;
}

function nameFromSupabaseUser(user, fallback) {
  const meta = user?.user_metadata || {};
  const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(" ");
  return cleanName(
    meta.display_name ||
      meta.full_name ||
      meta.name ||
      fullName ||
      user?.email?.split("@")[0] ||
      fallback,
    "Player",
  );
}

/**
 * Resolve a socket handshake into a verified identity. `verifyAccessToken` is
 * injected so this module has no Supabase dependency in tests.
 */
export function createIdentityResolver({ allowGuests, verifyAccessToken } = {}) {
  return async function resolveIdentity(socket) {
    const auth = socket.handshake.auth || {};
    if (!auth.token || typeof verifyAccessToken !== "function") {
      const err = new Error("Sign in to play");
      err.code = "unauthorized";
      throw err;
    }

    let user = null;
    try {
      user = await verifyAccessToken(String(auth.token));
    } catch {
      user = null;
    }
    if (!user?.id) {
      const err = new Error("Sign in to play");
      err.code = "unauthorized";
      throw err;
    }

    if (user.is_anonymous && !allowGuests) {
      const err = new Error("Guest play is disabled");
      err.code = "guests_disabled";
      throw err;
    }

    const meta = user.user_metadata || {};
    return {
      kind: "supabase",
      authUserId: user.id,
      isGuest: Boolean(user.is_anonymous),
      name: nameFromSupabaseUser(user, auth.displayName),
      avatarUrl: meta.avatar_url || meta.picture || null,
    };
  };
}
