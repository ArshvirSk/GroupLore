import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createIdentityResolver,
  signReconnectToken,
  verifySignedToken,
} from "../engine/auth.js";

const users = new Map([
  ["valid", { id: "user-valid", user_metadata: { display_name: "Ada" } }],
  ["anonymous", { id: "user-anon", is_anonymous: true, user_metadata: {} }],
]);
const verifyAccessToken = async (token) => {
  if (token === "expired" || token === "forged") return null;
  return users.get(token) || null;
};
const socket = (token) => ({ handshake: { auth: { token } } });

test("valid Supabase token resolves to the auth uid and display name", async () => {
  const resolve = createIdentityResolver({ allowGuests: true, verifyAccessToken });
  const identity = await resolve(socket("valid"));
  assert.equal(identity.authUserId, "user-valid");
  assert.equal(identity.name, "Ada");
  assert.equal(identity.isGuest, false);
});

test("anonymous Supabase token resolves as a guest", async () => {
  const resolve = createIdentityResolver({ allowGuests: true, verifyAccessToken });
  const identity = await resolve(socket("anonymous"));
  assert.equal(identity.authUserId, "user-anon");
  assert.equal(identity.isGuest, true);
});

test("expired, forged and missing tokens are rejected", async () => {
  const resolve = createIdentityResolver({ allowGuests: true, verifyAccessToken });
  for (const token of ["expired", "forged", undefined]) {
    await assert.rejects(resolve(socket(token)), (err) => err.code === "unauthorized");
  }
});

test("ALLOW_GUESTS=false rejects anonymous identities server-side", async () => {
  const resolve = createIdentityResolver({ allowGuests: false, verifyAccessToken });
  await assert.rejects(
    resolve(socket("anonymous")),
    (err) => err.code === "guests_disabled",
  );
});

test("reconnect tokens remain scoped to a session and player id", () => {
  const token = signReconnectToken({
    sessionId: "session-1",
    playerId: "user-valid",
  });
  const payload = verifySignedToken(token);
  assert.equal(payload.kind, "reconnect");
  assert.equal(payload.sid, "session-1");
  assert.equal(payload.pid, "user-valid");
});
