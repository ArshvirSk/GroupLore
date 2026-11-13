# Auth and Lobby Refactor Decisions

## Audit findings

The findings below describe the pre-migration Express server and are kept for
history. The current runtime is `client/server.mjs`; the engine lives in
`client/src/server/engine/`.

- The live server uses `GameEngine` in `server/index.js`. `server/sockets/index.js`, `lobbyHandler.js` and `gameHandler.js` are an older unused path; they are not mounted and still trust client-provided `userId`/`socketId`.
- Identity currently has two branches: verified Supabase users and a custom HMAC-signed guest token (`server/engine/auth.js`, `server/routes/auth.js`). Guests have no Supabase id.
- Routes still resolve `users.id` from `auth_user_id`; `group_members`, `game_sessions`, `activity_log` and `player_stats` all reference that legacy id.
- `groups.join_code` is acting as both group invite code and room code. `game_sessions` is acting as the lobby, with `group_id` and `status='lobby'`.
- `game_sessions` has no lobby row, no lobby players, no host ownership, and no partial unique index for one open lobby per group.
- The client stores a separate guest identity in `localStorage`; `AuthProvider` syncs a legacy `dbUserId` into `useUserStore`; socket auth can send `guestToken`.
- `member_profiles` is a separate legacy table referenced only by the group/member/feed routes. It will remain untouched as instructed.

## Decisions

1. **One identity source:** Supabase auth uid (`auth.uid()` / `user.id`) is the only player and user id. Anonymous users are real Supabase users with `is_anonymous=true`. The custom guest token tables, route and client storage are removed.
2. **Guest enforcement is server-side:** `ALLOW_GUESTS=false` makes the central auth middleware reject anonymous JWTs on both HTTP and Socket.io. The client also reads `/api/auth/config` so it does not offer anonymous sign-in, but the server is authoritative.
3. **Guest upgrade:** the client upgrades an anonymous user with `supabase.auth.updateUser({ email, password })`. This keeps the Supabase user id, so `profiles`, `lobby_players`, `game_sessions` history and the socket identity do not change.
4. **Profiles replace `users` for new code:** `profiles.id` is the auth uid. The legacy `users` table remains only to support untouched `member_profiles` data and old activity/stat backfills; no new route will resolve through it.
5. **Groups:** `groups.owner_id` becomes the auth uid. `group_members.role` uses `owner|member`; existing `host` rows are converted to `owner`. Group `join_code` is removed because invites are lobby codes, not permanent group secrets.
6. **Lobbies:** `lobbies` is the ephemeral room. `lobby_players` is the only source of room membership. `game_sessions.lobby_id` is the run; the group is derived through `lobbies.group_id`. A game session is created by the start endpoint, not when a group is opened.
7. **Room codes:** six characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/O/1/I`), unique among `status='open'` lobbies. Closing a lobby frees its code for reuse.
8. **Open-or-get:** any group member may call `POST /groups/:id/lobby`. It returns the existing open lobby for that group or creates one. Quick play is only for non-guests and always creates `group_id NULL`.
9. **Join vs membership:** joining by code inserts/updates `lobby_players` only. It never inserts `group_members`. Group membership is a separate, deliberate action after the lobby.
10. **Host:** the lobby creator is host. Host transfer picks the longest-connected remaining player by `joined_at`, skips disconnected players, and persists `lobbies.host_id`. An empty lobby closes and `closed_at` is set.
11. **Reconnect:** socket identity is the verified auth uid. The engine uses that uid as the stable player id; reconnect tokens remain only as a seat-proof optimization and never create an identity. Reconnect rehydrates the current `viewFor` snapshot.
12. **Start:** only the lobby host may start. The API verifies `status='open'` and connected players against the registry minimum, marks the lobby `in_game`, creates the `game_sessions` row with `lobby_id`, and returns the session id.
13. **Migration order:** `supabase-migration-supabase-auth.sql`, `supabase-migration-auth-rls.sql`, then the new `supabase-migration-auth-lobbies.sql`. The new migration is idempotent and includes rollback notes.
14. **Compatibility choice:** `member_profiles.user_id` is not migrated. Member-profile routes keep a legacy-id lookup bridge through `users.auth_user_id`; this is the only remaining legacy user-id path and is documented as a follow-up.
15. **Error shape:** every new/updated API error returns `{ error: { code, message } }` with 401/403/404/409 as appropriate. Existing member/feed routes are brought onto the same helper where touched.

## Blockers / follow-ups

- Supabase must have **Anonymous sign-ins** enabled in the dashboard for guest play. `ALLOW_GUESTS=false` blocks them at the app server but cannot disable the Supabase provider itself.
- `member_profiles` migration is intentionally out of scope; its `user_id` values still point at the legacy `users.id` space.
- Visual/manual browser verification was not part of the automated test run.

## Verification status

- `cd client && npm run test:server`: 62 tests pass, including the live RLS probe.
- `cd client && npm run test:api`: 8 contract/auth/game-flow tests pass against a production-mode server on port 3199.
- `.github/workflows/ci.yml`: lint, unit tests, and production build run without live credentials.
- `cd client && npx tsc --noEmit`: clean.
- `cd client && npm run lint`: 0 errors; one pre-existing unused-variable warning in `fiveSecond.js`.
- `cd client && npm run build`: successful.
- `npm run check:api`: public and unauthenticated contract checks pass against port 3000.

## Remaining limitations

- The configured Supabase project currently has **Anonymous sign-ins disabled**, so live guest HTTP cases are skipped in `test:api`. The guest policy is still covered by `test:server`.
- The live API test creates and removes temporary Supabase users, groups, lobbies, and sessions; it should run against a disposable or staging project in the future.
- `member_profiles.user_id` intentionally remains in the legacy `users.id` space. New users get a bridge `users` row on demand, but a future migration should collapse that table.
- Lobby player `connected` is maintained by join/leave; socket disconnect presence for pre-game lobby screens is not streamed because the lobby uses REST polling.
- Rate limits and nudges are process-scoped; a multi-instance deployment needs a shared store.
