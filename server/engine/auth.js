import crypto from "node:crypto";

/**
 * Token + identity helpers for the game engine.
 *
 * Two kinds of players are supported:
 *  - Supabase users: the client sends its Supabase access token in the socket
 *    handshake. The server verifies it with Supabase Auth.
 *  - Guests: the client exchanges a display name for a short signed guest token.
 *
 * Reconnect tokens are separate: they prove "I am the player who was in seat X",
 * so a refreshed tab can reclaim the same seat without trusting a client-supplied id.
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

export function signGuestToken({ guestId, name }, ttlMs = 7 * 24 * 60 * 60 * 1000) {
  return signToken({ kind: "guest", sub: guestId, name }, ttlMs);
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
    meta.full_name ||
      meta.name ||
      meta.display_name ||
      fullName ||
      user?.email?.split("@")[0] ||
      fallback,
    "Player",
  );
}

/**
 * Resolve a socket handshake into an identity.
 * Throws an error with `code = "unauthorized"` when no valid credential is present.
 *
 * `verifyAccessToken` is injected by the server so this module stays usable in
 * tests and never creates its own Supabase client.
 */
export function createIdentityResolver({ allowGuests, verifyAccessToken } = {}) {
  return async function resolveIdentity(socket) {
    const auth = socket.handshake.auth || {};

    if (auth.token && typeof verifyAccessToken === "function") {
      try {
        const user = await verifyAccessToken(String(auth.token));
        if (user?.id) {
          const meta = user.user_metadata || {};
          return {
            kind: "supabase",
            authUserId: user.id,
            name: nameFromSupabaseUser(user, auth.displayName),
            avatarUrl:
              meta.avatar_url ||
              meta.picture ||
              (typeof auth.avatarUrl === "string" ? auth.avatarUrl : null),
          };
        }
      } catch {
        // Fall through to the guest token / unauthorized error.
      }
    }

    if (auth.guestToken && allowGuests) {
      const guest = verifySignedToken(auth.guestToken);
      if (guest?.kind === "guest" && guest.sub) {
        return {
          kind: "guest",
          guestId: String(guest.sub),
          name: cleanName(auth.displayName || guest.name, "Guest"),
          avatarUrl: null,
        };
      }
    }

    const err = new Error("Sign in to play");
    err.code = "unauthorized";
    throw err;
  };
}
