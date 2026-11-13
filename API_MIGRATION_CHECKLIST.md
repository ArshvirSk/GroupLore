# API Migration Checklist — Express to Next.js Route Handlers

**Status: complete.** All **31** REST routes now live under
`client/src/app/api/**/route.ts`. The Express server was removed after the
contract/auth and multi-client game tests passed. The final suite is 63
unit tests plus 8 live API/game-flow tests; CI runs lint, unit tests, and the
production build.

This checklist documents the migration from the retired `server/index.js`.

The target is:

- Same URL paths under `client/src/app/api/**/route.ts`
- Same response envelopes and status codes
- Same auth and membership rules
- Same client-visible field names
- No CORS or `NEXT_PUBLIC_SERVER_URL` once the client and API are same-origin

Engine/game/auth tests now live in `client/src/server/test/`. The live REST
contract and multi-client game test is `client/test/api.integration.test.mjs`.

The server boundary is explicit: API helpers import `server-only`, and ESLint
rejects `@/server/*` imports from client components, hooks, stores, and
non-API app files.

---

## Shared contract

### Error envelope

Every error response must remain:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
  };
};
```

The generic helpers in `server/lib/http.js` map to:

| Express helper | Status | Code |
|---|---:|---|
| `fail(res, status, code, message)` | as passed | as passed |
| `unauthorized` | 401 | `unauthorized` |
| `forbidden` | 403 | `forbidden` |
| `notFound` | 404 | `not_found` |
| `conflict` | 409 | as passed |
| `badRequest` | 400 | passed code, default `bad_request` |
| `serverError` | 500 | `server_error` |

Do not rewrite messages while migrating. Several clients show them directly.

### Auth helper mapping

| Express middleware | Next.js helper requirement |
|---|---|
| `requireUser` | Verify `Authorization: Bearer <Supabase access token>` with `supabase.auth.getUser(token)`. Return 401 `unauthorized` if missing/invalid. Return 403 `guests_disabled` when an anonymous user is present and `ALLOW_GUESTS=false`. Ensure the `profiles` row exists and expose `{ id, displayName, avatarUrl, isGuest, email, profile }`. |
| `requireNonGuest` | Return 401 `unauthorized` without a user, then 403 `guest_forbidden` for anonymous users. |
| `requireGroupMember(param)` | Return 400 `group_required`, 403 `not_group_member`, or 500 `server_error`. Resolve the group id from path params, body `groupId`, or query `groupId`, matching the current helper. |
| `requireGroupOwner(param)` | Return 403 `not_group_member` or 403 `owner_only`; 500 on lookup failure. |
| `requireHost(param)` | Load the lobby, return 404 `lobby_not_found` or 403 `host_only`; 500 on lookup failure. |
| `requireLobbyMember` | Load the lobby, return 404 `lobby_not_found` or 403 `not_in_lobby`; 500 on lookup failure. |
| `requireSessionMember` | Return 400 `session_required`, 404 `session_not_found`, or 403 `not_in_lobby`; 500 on lookup failure. |
| `joinLimiter` | Preserve 20 requests/minute per IP and 10/minute per user; return 429 `rate_limited` with the existing message. |

All authenticated responses should be `Cache-Control: no-store`. Set:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

on every handler that reads auth, cookies, Supabase, or mutable state.

### Next.js 16 dynamic params

Dynamic route params are asynchronous:

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
}
```

Apply this to every `[param]` folder.

### Route precedence

These static segments must win over dynamic siblings:

- `/api/groups/my` over `/api/groups/[id]`
- `/api/feed/stats` and `/api/feed/active-lobbies` over `/api/feed`
- `/api/games/catalog` and `/api/games/active/[groupId]` over `/api/games/[id]`
- `/api/lobbies/id/[id]` over `/api/lobbies/[code]`

The static-first layout preserves the retired Express route precedence.

### Shared response types

Define these once in `client/src/server/api/types.ts`:

```ts
type UserPayload = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  email: string | null;
};

type LobbyPlayer = {
  lobby_id: string;
  user_id: string;
  display_name: string;
  is_guest: boolean;
  connected: boolean;
  joined_at: string;
};

type Lobby = {
  id: string;
  code: string;
  group_id: string | null;
  host_id: string | null;
  status: "open" | "in_game" | "closed";
  created_at: string;
  closed_at: string | null;
  groups?: { id: string; name: string } | null;
  lobby_players: LobbyPlayer[];
  active_session_id?: string | null;
};

type GroupSummary = {
  // all groups columns
  role: "owner" | "member";
  joined_at: string;
  lobby: Lobby | null;
};

type GroupDetail = {
  // all groups columns
  role: "owner" | "member";
  members: Array<{
    id: string | null;
    user_id: string | null;
    display_name: string;
    avatar_url: string | null;
    is_guest: boolean;
    role: "owner" | "member";
    joined_at: string;
  }>;
  lobby: Lobby | null;
};

type GameCatalogItem = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  accent: string;
  minPlayers: number;
  maxPlayers: number;
  modes: Array<{ id: string; label: string; description: string }>;
};
```

Other success bodies reference the existing database row shape for `member_profiles`, `game_sessions`, `activity_log`, and `player_stats`.

### Cross-cutting migration tasks

- [x] Parse JSON bodies with `await request.json()`, then validate before using fields.
- [x] Preserve UUID and 6-character room-code validation.
- [x] Preserve the 64 KB body limit (`readJson` in `client/src/server/api/http.ts`).
- [x] Remove `cors` once API and client share an origin.
- [x] Change client `API_URL` to `""` so requests go to `/api/...`.
- [x] Keep the Supabase service-role client server-only.
- [x] Move in-process rate limiting to a single process-scoped store. Multi-instance deployments still need Redis/Upstash.
- [x] Move the in-memory nudge map to a process singleton (`globalThis`) or a durable store. Nudges remain intentionally ephemeral and are lost on restart.
- [x] Do not couple REST handlers to the in-memory game engine. `POST /api/lobbies/[id]/start` only creates the database session; the realtime host starts the engine with a normal room action.
- [x] Preserve the current kick behavior: REST deletes the lobby player row only; it does not emit a socket kick event.
- [x] Add contract tests that assert status, error code, and response keys, not only the happy path.

---

## Endpoint checklist

### Auth — 2 routes

#### [x] A01 — `GET /api/auth/config`

- **File:** `client/src/app/api/auth/config/route.ts`
- **Auth:** Public
- **Input:** none
- **Success:** `200 { guestsEnabled: boolean }`
- **Errors:** none
- **Tests:** `ALLOW_GUESTS=true` returns `true`; `false` returns `false`; request succeeds without a token.

#### [x] A02 — `POST /api/auth/guest`

- **File:** `client/src/app/api/auth/guest/route.ts`
- **Auth:** Public
- **Input:** none
- **Success:** none; this endpoint is intentionally removed
- **Errors:** `410 { error: { code: "guest_endpoint_removed", message: "Use Supabase anonymous sign-in for guest play." } }`
- **Tests:** assert 410, exact code/message, and that no Supabase guest token is created.

### Users — 2 routes

#### [x] U01 — `POST /api/users/sync`

- **File:** `client/src/app/api/users/sync/route.ts`
- **Auth:** `requireUser`; creates/updates the profile row as a side effect
- **Input:** none
- **Success:** `200 UserPayload`
- **Errors:** 401 `unauthorized`; 403 `guests_disabled`; 401 `unauthorized` if profile lookup fails
- **Tests:** new user creates profile; existing user updates profile; missing token 401; guest with guests disabled 403.

#### [x] U02 — `GET /api/users/me`

- **File:** `client/src/app/api/users/me/route.ts`
- **Auth:** `requireUser`
- **Input:** none
- **Success:** `200 UserPayload`
- **Errors:** same as U01
- **Tests:** returns the same payload as sync; no extra fields; cache-control no-store.

### Groups — 9 routes

#### [x] G01 — `POST /api/groups`

- **File:** `client/src/app/api/groups/route.ts`
- **Auth:** `requireUser` + `requireNonGuest`
- **Input:** `{ name: string }`, trimmed to 60 chars; control characters removed
- **Success:** `201 { ...group, role: "owner", lobby: null }`
- **Errors:** 400 `name_required`; 401 `unauthorized`; 403 `guest_forbidden`; 500 `server_error`
- **Tests:** valid create returns 201 and owner membership; blank/control-only name 400; guest 403; cleanup if membership insert fails.

#### [x] G02 — `GET /api/groups`

- **File:** `client/src/app/api/groups/route.ts`
- **Auth:** `requireUser` + `requireNonGuest`
- **Input:** none
- **Success:** `200 GroupSummary[]`, sorted as returned by Supabase; each group has `role`, `joined_at`, and current open `lobby` or `null`
- **Errors:** 401/403; 500 `server_error`
- **Tests:** empty membership returns `[]`; multiple groups include the correct open lobby; no lobby returns `null`; guest 403.

#### [x] G03 — `GET /api/groups/my`

- **File:** `client/src/app/api/groups/my/route.ts`
- **Auth:** `requireUser` + `requireNonGuest`
- **Input:** none
- **Success:** same `GroupSummary[]` as G02
- **Errors:** same as G02
- **Tests:** `/my` reaches this handler, not `[id]`; parity with G02.

#### [x] G04 — `GET /api/groups/[id]`

- **File:** `client/src/app/api/groups/[id]/route.ts`
- **Auth:** `requireUser` + `requireNonGuest` + `requireGroupMember("id")`
- **Input:** dynamic `id`
- **Success:** `200 GroupDetail` with all group columns, current `role`, mapped `members`, and open `lobby` or `null`
- **Errors:** 400 `group_required`; 403 `not_group_member`; 404 `not_found`; 500 `server_error`
- **Tests:** owner/member detail; nonmember 403; missing group 404; member mapping preserves `user_id`, `role`, `joined_at`; open lobby included.

#### [x] G05 — `POST /api/groups/[id]/lobby`

- **File:** `client/src/app/api/groups/[id]/lobby/route.ts`
- **Auth:** `requireUser` + `requireNonGuest` + `requireGroupMember("id")`
- **Input:** dynamic `id`; no body
- **Success:** `201 Lobby` when created; `200 Lobby` when an open lobby already existed
- **Errors:** 400/403 membership errors; 500 `server_error`
- **Tests:** first call 201; second call 200 and same lobby; creator/joiner gets `lobby_players` row; code collision retry.

#### [x] G06 — `DELETE /api/groups/[groupId]/leave`

- **File:** `client/src/app/api/groups/[groupId]/leave/route.ts`
- **Auth:** `requireUser` + `requireNonGuest`; manual membership check inside the handler
- **Input:** dynamic `groupId`
- **Success:** `200 { success: true, groupDeleted: false }` after leaving a non-empty group; `200 { success: true, groupDeleted: true }` when the last member leaves and the group is deleted
- **Errors:** 403 `not_group_member`; 401/403 auth; 500 `server_error`
- **Tests:** member leave; owner leave transfers ownership to oldest remaining member; last-member leave deletes group; nonmember 403; `member_left` activity logged.

#### [x] G07 — `DELETE /api/groups/[groupId]/members/[targetUserId]`

- **File:** `client/src/app/api/groups/[groupId]/members/[targetUserId]/route.ts`
- **Auth:** `requireUser` + `requireNonGuest` + `requireGroupOwner("groupId")`
- **Input:** dynamic `groupId`, `targetUserId`
- **Success:** `200 { success: true }`
- **Errors:** 400 `cannot_remove_self`; 403 `not_group_member`/`owner_only`; 404 `not_found`; 500 `server_error`
- **Tests:** owner removes member; self-target 400; non-owner 403; target not in group 404; deleted membership row.

#### [x] G08 — `POST /api/groups/[id]/nudge`

- **File:** `client/src/app/api/groups/[id]/nudge/route.ts`
- **Auth:** `requireUser` + `requireNonGuest` + `requireGroupMember("id")`
- **Input:** dynamic `id`; no body
- **Success:** `200 { sent: true, message: string }`
- **Errors:** 400/403 membership; 401/403 auth; no explicit 500 path currently
- **Tests:** message comes from the fixed bank; queue caps at 10; nonmember 403; guest 403; state is process-local.

#### [x] G09 — `GET /api/groups/[id]/nudges`

- **File:** `client/src/app/api/groups/[id]/nudges/route.ts`
- **Auth:** `requireUser` + `requireNonGuest` + `requireGroupOwner("id")`
- **Input:** dynamic `id`
- **Success:** `200 Array<{ message: string; from: string; timestamp: number }>`; queue is drained after read
- **Errors:** 403 `not_group_member`/`owner_only`; 401/403 auth
- **Tests:** owner drains queue; member 403; subsequent read returns `[]`; no cross-group leakage.

### Invites — 1 route

#### [x] I01 — `GET /api/invites/[code]`

- **File:** `client/src/app/api/invites/[code]/route.ts`
- **Auth:** Public
- **Input:** dynamic `code`, normalized uppercase; must match `^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$`
- **Success:** `200 { lobby: { id, code, status, group_id }, group: { id, name } | null, guestsEnabled: boolean }`
- **Errors:** 400 `invalid_code`; 404 `not_found`; 500 `server_error`
- **Tests:** valid open/in-game invite; closed invite 404; invalid code 400; response never includes members or history; guests flag matches config.

### Lobbies — 7 routes

All lobby routes run `requireUser` at the router level.

#### [x] L01 — `POST /api/lobbies`

- **File:** `client/src/app/api/lobbies/route.ts`
- **Auth:** `requireUser` + `requireNonGuest`
- **Input:** none
- **Success:** `201 Lobby` for a new quick-play room
- **Errors:** 401 `unauthorized`; 403 `guest_forbidden`; 500 `server_error`
- **Tests:** guest 403; account gets 201, host id, own `lobby_players` row; unique room code; no group id.

#### [x] L02 — `POST /api/lobbies/join`

- **File:** `client/src/app/api/lobbies/join/route.ts`
- **Auth:** `requireUser`; guests are allowed; `joinLimiter` after user resolution
- **Input:** `{ code: string }`, normalized
- **Success:** `200 Lobby` with the joining player upserted
- **Errors:** 400 `invalid_code`; 404 `not_found`; 429 `rate_limited`; 401; 500
- **Tests:** guest joins; existing player rejoin is idempotent; invalid code 400; closed/missing room 404; 11th join in a minute 429; rate limit is per user and IP.

#### [x] L03 — `GET /api/lobbies/id/[id]`

- **File:** `client/src/app/api/lobbies/id/[id]/route.ts`
- **Auth:** `requireUser` + `requireLobbyMember`
- **Input:** dynamic `id`
- **Success:** `200 Lobby` with `groups` and `lobby_players`
- **Errors:** 404 `lobby_not_found`; 403 `not_in_lobby`; 401; 500
- **Tests:** member read succeeds; nonmember 403; missing 404; static `id` segment does not get captured by `[code]`.

#### [x] L04 — `GET /api/lobbies/[code]`

- **File:** `client/src/app/api/lobbies/[code]/route.ts`
- **Auth:** `requireUser`; any authenticated user may look up a code
- **Input:** dynamic `code`, normalized and validated
- **Success:** `200 Lobby` plus `active_session_id: string | null` for the latest non-finished session
- **Errors:** 400 `invalid_code`; 404 `not_found`; 401; 500
- **Tests:** open lobby shape; closed lobby 404; active session id included; no membership requirement; no accidental match against `/id/[id]`.

#### [x] L05 — `POST /api/lobbies/[id]/leave`

- **File:** `client/src/app/api/lobbies/[id]/leave/route.ts`
- **Auth:** `requireUser` + `requireLobbyMember`
- **Input:** dynamic `id`
- **Success:** `200 { success: true, closed: boolean, hostId: string | null }`
- **Errors:** 404 `lobby_not_found`; 403 `not_in_lobby`; 401; 500
- **Tests:** normal leave; host transfer to longest-connected remaining player; last player closes room; response fields match current helper.

#### [x] L06 — `POST /api/lobbies/[id]/kick`

- **File:** `client/src/app/api/lobbies/[id]/kick/route.ts`
- **Auth:** `requireUser` + `requireHost`
- **Input:** dynamic `id`; body `{ userId: string }`
- **Success:** `200 { success: true }`
- **Errors:** 400 `user_required`; 400 `cannot_kick_self`; 404 `lobby_not_found`; 403 `host_only`; 500
- **Tests:** host kicks target; self 400; non-host 403; missing user id 400; last player closes lobby; REST does not emit a realtime kick event, preserving current behavior.

#### [x] L07 — `POST /api/lobbies/[id]/start`

- **File:** `client/src/app/api/lobbies/[id]/start/route.ts`
- **Auth:** `requireUser` + `requireHost`
- **Input:** dynamic `id`; body `{ gameId: string; mode: string }`
- **Success:** `201 { sessionId: string; lobby: Lobby }`
- **Errors:** 404 `not_found` for unknown game; 400 `unknown_mode`; 409 `lobby_not_open`; 409 `not_enough_players`; 409 `too_many_players`; 404/403 host/membership; 500
- **Tests:** creates session row with `status: "lobby"`; sets lobby `in_game`; returns session id; rejects unknown game/mode; rejects below `minPlayers`, above `maxPlayers`, and already-started lobby; does not start the in-memory engine.

### Members — 3 routes

All member routes use `requireUser` + `requireNonGuest` at the router level.

#### [x] M01 — `GET /api/members/group/[groupId]`

- **File:** `client/src/app/api/members/group/[groupId]/route.ts`
- **Auth:** `requireUser` + `requireNonGuest` + `requireGroupMember("groupId")`
- **Input:** dynamic `groupId`
- **Success:** `200 member_profiles[]` for the group
- **Errors:** 400 `group_required`; 403 `not_group_member`; 401/403 auth; 500
- **Tests:** member sees rows; nonmember 403; empty group `[]`; no rows from another group.

#### [x] M02 — `POST /api/members/group/[groupId]`

- **File:** `client/src/app/api/members/group/[groupId]/route.ts`
- **Auth:** `requireUser` + `requireNonGuest` + `requireGroupMember("groupId")`; owner required only when editing another user
- **Input:** dynamic `groupId`; body `{ userId?, displayName, nickname?, traits?, habits?, iconicMoments?, catchphrases?, mostLikelyTo?, avatarUrl? }`
- **Success:** `200 member_profiles` when updating; `201 member_profiles` when inserting
- **Errors:** 400 `display_name_required`; 400 `not_group_member`; 400 `user_not_found`; 403 `owner_only`; 403 group membership; 500
- **Tests:** self upsert; owner edits another; non-owner edits another 403; requested user not in group 400; legacy `users.id` bridge preserved; list fields sanitized to 20 items/160 chars; HTTP avatar accepted only.

#### [x] M03 — `DELETE /api/members/[id]`

- **File:** `client/src/app/api/members/[id]/route.ts`
- **Auth:** `requireUser` + `requireNonGuest`; membership derived from the profile's group
- **Input:** dynamic `id`
- **Success:** `200 { success: true }`
- **Errors:** 404 `not_found`; 403 `not_group_member`; 403 `owner_only`; 401/403 auth; 500
- **Tests:** self delete; owner deletes another member's profile; non-owner deletes another 403; missing profile 404; profile from another group blocked.

### Games — 4 routes

All game routes use `requireUser` at the router level.

#### [x] X01 — `GET /api/games/catalog`

- **File:** `client/src/app/api/games/catalog/route.ts`
- **Auth:** `requireUser`
- **Input:** none
- **Success:** `200 GameCatalogItem[]` from `listGames()`, including mode metadata
- **Errors:** 401 `unauthorized`; 500 if catalog load fails
- **Tests:** all 21 games returned; required fields present; mode id/label/description preserved; unauthenticated 401; cache-control no-store.

#### [x] X02 — `GET /api/games/active/[groupId]`

- **File:** `client/src/app/api/games/active/[groupId]/route.ts`
- **Auth:** `requireUser` + `requireGroupMember("groupId")`
- **Input:** dynamic `groupId`
- **Success:** `200 Lobby` or `200 null`
- **Errors:** 400 `group_required`; 403 `not_group_member`; 401; lookup failures currently return `null`, not 500
- **Tests:** open lobby returned; no lobby `null`; nonmember 403; static `active` segment takes precedence over `[id]`.

#### [x] X03 — `POST /api/games`

- **File:** `client/src/app/api/games/route.ts`
- **Auth:** `requireUser` + `requireGroupMember("groupId")`, reading `groupId` from the **body** (the Express helper checks params, body, then query)
- **Input:** body `{ groupId: string }`
- **Success:** `201 Lobby`
- **Errors:** 400 `group_required`; 403 `not_group_member`; 401; 500
- **Tests:** member opens existing lobby (helper returns existing); first open creates one; missing body groupId 400; nonmember 403. Parse the body before calling membership auth.

#### [x] X04 — `GET /api/games/[id]`

- **File:** `client/src/app/api/games/[id]/route.ts`
- **Auth:** `requireUser` + `requireSessionMember`
- **Input:** dynamic `id`
- **Success:** `200 game_sessions` row with joined lobby access fields
- **Errors:** 400 `session_required`; 404 `session_not_found`; 403 `not_in_lobby`; 401; 500
- **Tests:** lobby member reads session; nonmember 403; missing 404; `catalog` and `active` static routes not captured.

### Feed — 3 routes

All feed routes use `requireUser` at the router level.

#### [x] F01 — `GET /api/feed`

- **File:** `client/src/app/api/feed/route.ts`
- **Auth:** `requireUser`
- **Input:** query `limit` (default 20, max 50) and `before` ISO timestamp (default now)
- **Success:** `200 activity_log[]` joined with `groups(name)` and `profiles(display_name, avatar_url)`
- **Errors:** 401; 500 `server_error`
- **Tests:** no memberships returns `[]`; limit clamp; before cursor; only groups the user belongs to; joined fields preserved.

#### [x] F02 — `GET /api/feed/stats`

- **File:** `client/src/app/api/feed/stats/route.ts`
- **Auth:** `requireUser`
- **Input:** none
- **Success:** `200 { stats: player_stats; badges: Badge[]; personalityByGroup: Array<{ groupName, displayName, traits }> }`
- **Errors:** 401; 500 `server_error`
- **Tests:** no stats returns `{ games_played: 0, games_won: 0 }`; badge thresholds; legacy profile join; empty personality array.

#### [x] F03 — `GET /api/feed/active-lobbies`

- **File:** `client/src/app/api/feed/active-lobbies/route.ts`
- **Auth:** `requireUser`
- **Input:** none
- **Success:** `200 Lobby[]` for the user's groups, newest first, including `groups(name)` and `lobby_players(*)`
- **Errors:** 401; 500 `server_error`
- **Tests:** no memberships `[]`; only open lobbies from member groups; ordering; guest allowed if authenticated (no `requireNonGuest` on this router); no cross-group leakage.

---

## Required test suites

### 1. Handler contract tests

For each endpoint, assert:

- Exact status code.
- Exact `error.code` for every failure branch.
- Required response keys and types.
- `Cache-Control: no-store` on authenticated responses.
- Dynamic params are awaited correctly.
- Body validation happens before membership/auth side effects.

Use direct route-handler imports with mocked Supabase and auth helpers for fast tests, plus a small number of real HTTP integration tests.

### 2. Auth matrix

The live suite covers missing, invalid, and expired tokens plus authenticated
member/non-member/host/owner/session boundaries. Guest HTTP assertions require
Supabase anonymous sign-ins; this project currently has that provider disabled,
so the guest policy is covered by the unit auth suite instead.

Run every protected endpoint with:

- No token → 401 `unauthorized`
- Invalid/expired token → 401 `unauthorized`
- Anonymous guest with `ALLOW_GUESTS=true` → allowed only where specified
- Anonymous guest with `ALLOW_GUESTS=false` → 403 `guests_disabled`
- Guest on `requireNonGuest` routes → 403 `guest_forbidden`

### 3. Membership matrix

For group, lobby, and session resources:

- Owner
- Regular member
- Authenticated nonmember
- Missing resource
- Resource from another group/lobby
- Deleted/kicked member

### 4. Realtime regression

Although these are REST routes, verify the surrounding flow after migration:

- Create group → open lobby → join by code → start session via REST → realtime room loads that session.
- Kick via REST removes the lobby player; the realtime engine behavior remains unchanged.
- TV spectator uses the SSE path, not a new REST endpoint.
- Host transfer and last-player close match current helper behavior.

### 5. In-memory state tests

- Nudge queue caps at 10 and drains on owner read (`apiState.test.js` plus the live nudge route).
- Join rate limit caps per user and resets after the window (`apiState.test.js` plus the live join route).
- Both are process-local and are not safe across multiple instances.

---

## Completion criteria

- [x] All 31 endpoints exist at the same paths with the same status codes and response envelopes.
- [x] All auth/membership error codes match the table above.
- [x] No client code references `localhost:3001`, `NEXT_PUBLIC_SERVER_URL`, or CORS.
- [x] `server/` can be deleted without breaking the client build.
- [x] REST contract tests and the multi-client realtime test pass against the configured Supabase project.
- [x] A production Next.js process serves the app, API, and SSE realtime stream on one origin.
- [x] Secret scan confirms the service-role key is not present in the client bundle.
- [x] Every public game module has an initialization/view smoke test.
- [x] The live suite covers `room:hello`, `room:sync-request`, `room:leave`, reconnect, and host transfer against the production server.
- [x] Deployment, reverse-proxy SSE, and rollback procedures are documented in `docs/DEPLOYMENT.md`.
