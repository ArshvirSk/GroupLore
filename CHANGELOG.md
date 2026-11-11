# Changelog

All phase work is recorded here with what was verified and what was deferred.

## Start flow simplification

### Shipped

- **Any group member can open a lobby and start.** The host is no longer a gatekeeper for game selection or start; the host still owns kick, end and restart. The group page's poke/roast flow is gone.
- **Shareable invite links.** Every group has a `/join/:code` URL. It sends signed-out visitors through sign-in/sign-up, joins the group, and lands them in an open lobby or the group page. The group page and lobby both expose a copy-link action.
- **Dashboard creation without the landing-page loop.** **New Group** expands an inline name form on the dashboard and creates the group there. Group cards and the quick-play bar can open a lobby directly.
- **Fewer setup screens.** The normal path is now dashboard → lobby → game. Invitees go from invite link → auth (if needed) → lobby/group.
- **Ready gate removed.** Players no longer need to tap Ready up; a lobby starts when the selected game has enough connected players. The engine no longer checks readiness.
- **Player minimums are visible before selection.** Every game card shows how many more players it needs, and the lobby shows a targeted invite prompt for the selected game. New lobbies preselect the session's default game.

### Verified

- `server npm test` — **28/28 passing**, including a non-host selecting and starting a game without readying up.
- Hosted three-user smoke test — a non-host opened the lobby, a second non-host selected **Would You Rather**, and the lobby opener started it; the session row became `active` with the correct `game_type`. Temporary users and group data were deleted afterwards.
- `client npm run build` — success; `/join/[code]` is in the route manifest.
- `client npx eslint src` — 0 errors, 4 pre-existing warnings.

### Not verified / deferred

- The invite and dashboard forms compile but were not clicked through in a visual browser run.

## Guest entry

### Shipped

- **Invite links now offer a choice.** A signed-out visitor sees the group, whether a lobby is open, and two paths: continue as a named guest or sign in/create an account.
- **Guests can enter an open lobby without an account.** A new `/guest` page takes a display name and 6-character lobby code. The home page and sign-in page both link to it.
- **Public invite lookup.** `GET /api/invites/:code` resolves only the group name and its open lobby; it does not require auth or expose members, history, or private game data. Guest tokens are issued by the existing signed-token flow and accepted only for room joins.
- **Guest limits are explicit.** Guests cannot create or join groups, open lobbies, view group history, or access the dashboard. They can play an already-open lobby and use the normal room/game controls.
- **Guest navigation returns home.** Lobby and game exits send guests to `/` rather than a protected group page, and group-only invite controls are hidden.
- **`ALLOW_GUESTS` is enabled in the example configuration.** Set it to `false` to require an account for every player. `/api/health` now reports the effective guest setting.

### Verified

- `server npm test` — **28/28 passing**.
- `client npm run build` — success; `/guest` is in the route manifest.
- `client npx eslint src` — 0 errors, 4 pre-existing warnings.
- Hosted three-player smoke test — a signed-in host plus two guests joined a lobby resolved through the public invite endpoint; a guest started the preselected game and the session became active. Temporary data was deleted.

### Not verified / deferred

- The guest invite and `/guest` forms compile but were not clicked through in a visual browser run.
- Guests are intentionally limited to an **already-open lobby**; they cannot create a lobby or join a group. Fully account-free groups are not supported.

## Phase 4 — seven more games

### Shipped

- **Liars Bar** (`liars-bar`): the rotating storyteller gets a true statement and a matching lie, picks one, and the group votes truth or lie. Non-liars score 1 each when the group reads it correctly; the storyteller scores 2 when the group is fooled. Five Classic rounds and three Quick rounds.
- **Higher / Lower** (`higher-or-lower`): players rate every other player from 1 to 10 on a category, the server averages those ratings into a hidden ranking, and the room calls whether the next player ranks higher or lower. Ratings replace the old profile-derived stats. Six Classic calls and four Quick calls.
- **Avoid the Answer** (`avoid-the-answer`): one player sees a secret word and its banned words and must describe it without using any of them; everyone else guesses from the word options. The guesser scores 2, the describer 1. Banned words are rejected server-side.
- **Would You Rather** (`would-you-rather`): two options, one vote each, majority scoring and a full split at the reveal. Ties award every voter 1.
- **Caption This** (`caption-this`): everyone writes an anonymous caption for the same scenario, then votes for someone else's. Captions score 1 per vote and authors stay hidden until the reveal.
- **Wavelength** (`wavelength`): a rotating clue giver sees a hidden target on a labelled spectrum and sends one clue; the group guesses 0–100. Each guesser scores 2 within 10 points and 1 within 20; the clue giver is scored against the group average.
- **Category Rush** (`category-rush`): one category and one required starting letter per round. Unique valid answers score 2 and matching answers score 1; the server enforces the letter.
- **Screens and routing:** seven new game components are routed by `room.gameId`, and the fallback no longer catches any Phase 4 id. Every module implements private `viewFor` and redacted `publicFor` for the TV.
- **Prompt banks:** 24 Liars Bar truth/lie pairs, 30 Higher/Lower categories, 30 Avoid the Answer secret/banned sets, 30 Would You Rather pairs, 25 Caption This scenarios, 25 Wavelength spectra and 30 Category Rush category/letter prompts.
- **Database migration:** `supabase-migration-phase4-games.sql` adds the seven ids to the `game_sessions.game_type` CHECK; `supabase-schema.sql` is updated for fresh installs. The migration was applied to the hosted Supabase project on 2026-11-11.
- **Best Friend Test is retired rather than ported.** Its mechanic depends on `member_profiles` and would break the rule that current games are independent of lore. The legacy id stays in the CHECK constraint for old rows only.

### Verified

- `server npm test` — **28/28 passing**: the existing suites plus Liars Bar secrecy and group scoring, Higher/Lower ranking and calls, Avoid the Answer banned-word validation and scoring, Would You Rather majority/tie scoring, Caption This author privacy and vote scoring, Wavelength target secrecy and closeness scoring, Category Rush letter enforcement and unique-answer scoring, and all Phase 4 bank sizes/id uniqueness.
- `client npm run build` — success; all game routes still compile.
- `client npx eslint src` — 0 errors, 4 pre-existing warnings.
- Hosted Phase 4 migration — the `game_sessions_game_type_check` constraint now contains all 16 ids.
- Hosted end-to-end start — three disposable Supabase users created a group and started a Classic session for each of the seven games through the real REST and Socket.io paths. Each session row became `active` with the matching `game_type`. All temporary auth users, app users, group, sessions, members, profiles, stats and activity rows were deleted afterwards (verified counts: 0 remaining).

### Not verified / deferred

- No live browser playthrough of the seven screens was performed; they compile but were not clicked through.

## Supabase Auth migration

### Shipped

- **Clerk removed end to end.** The client no longer depends on `@clerk/nextjs` or `@clerk/themes`, there is no `ClerkProvider` or middleware, and the server no longer reads `CLERK_SECRET_KEY`. Sign-in and sign-up are Supabase email/password forms.
- **Supabase sessions drive both transports.** `AuthProvider` owns the browser session, REST calls send `Authorization: Bearer <access token>`, and the room/TV socket handshakes send the same token. Express and Socket.io both verify it with `supabase.auth.getUser`.
- **App rows link through `users.auth_user_id`.** `/api/users/sync` creates or links the app row on sign-in, matching an existing row by email so groups and stats survive the provider change. Group membership, feed, members and seed routes now use the Supabase user id.
- **Schema migration.** `supabase-schema.sql` uses `auth_user_id` for fresh installs; `supabase-migration-supabase-auth.sql` adds the column, copies the old id, drops `clerk_id` and adds a unique index for existing projects.
- **App tables are server-only.** RLS is enabled on all app tables, the old `USING (true)` policies are removed, and direct grants to `anon`/`authenticated` are revoked. The browser anon key is used only for auth; the Express API keeps the service role.
- **Guest and reconnect paths preserved.** Signed guest tokens, reconnect tokens, the 30-second handshake refresh and server-authoritative room membership are unchanged.
- **Email confirmation links are removed from the normal sign-up flow.** The hosted Supabase project has **Confirm email** off, so a new account receives a session immediately and goes straight to the dashboard. The client no longer sends an `emailRedirectTo` or asks the user to find a confirmation link.

### Verified

- `server npm test` — **20/20 passing**, including the new Supabase identity resolution test.
- `client npm run build` — success; `/sign-in`, `/sign-up`, `/dashboard`, `/group`, `/lobby`, `/game` and `/tv` compile.
- `client npx eslint src` — 0 errors, 4 warnings (hook dependency and unused-variable warnings in existing screens).
- Supabase email/password — a temporary confirmed user was created, signed in through the anon client, and its access token was accepted by `supabase.auth.getUser`; the temporary user was deleted.
- Hosted schema — `supabase-migration-supabase-auth.sql` left `users.auth_user_id` present, dropped `clerk_id`, and created the unique index.
- Live end-to-end — a temporary auth user with a pre-existing app row (matched by email) synced to the same `dbUserId`, created and listed a group, opened a lobby session, and joined the room socket with the database display name rather than the spoofed handshake name. All temporary rows and the auth user were deleted.
- RLS lock-down — an anonymous client received `42501` for both `SELECT` and `INSERT` on `users`; a service-role read and `/api/users/sync` write both succeeded. The temporary auth user and app row were deleted.

### Not verified / deferred

- The browser sign-in form itself was compiled but not clicked through in this run; the REST and socket paths it calls were verified end to end.
- The immediate-session sign-up path was verified against the hosted project after disabling **Confirm email**. The fallback confirmation-required path remains implemented but was not exercised in this configuration.

## Phase 3 — Hive Mind, Odd One Out, Bluff and Hot Takes

### Shipped

- **Hive Mind** (`hive-mind`): everyone answers the same prompt, answers are grouped with the existing fuzzy text matcher, and each matching group scores its size. Unique answers score nothing. Five rounds; Classic (20s) and Speed (10s) modes.
- **Odd One Out** (`odd-one-out`): one player secretly receives a related-but-different prompt. All answers are anonymous, the room discusses, then votes for the odd player. Four-player minimum; Classic and Blind modes. Crew score when the odd player is caught, the odd player scores 2 when they escape.
- **Bluff** (`bluff`): an obscure word/definition question; everyone writes a fake definition, the real answer is mixed into the choices, and players vote for the real one. Self-votes are rejected server-side. Real-answer voters score 2, bluff authors score 1 per player fooled, and exact real answers score 1. Five rounds; Quick mode is three rounds.
- **Hot Takes** (`hot-takes`): agree/disagree on an opinion statement. The minority side scores 2, the majority scores 1; ties and unanimous votes give every voter 1. Six rounds; Classic and Slow Burn modes.
- **Screens and routing:** four new game components are routed by `room.gameId`; the lobby catalogue now exposes eight playable games and all exposed modes have a real behaviour.
- **TV coverage:** all four new modules implement `publicFor`; the TV shows their prompt/question, progress and public reveal data. Odd One Out never sends either prompt to the TV before the reveal.
- **Prompt banks:** one shared 150-pair bank (`hive.json`) powers Hive Mind's `text` prompts and Odd One Out's crew/odd prompts; 60 original Bluff question/answer pairs; 80 original Hot Takes statements.
- **Database migration:** `supabase-migration-phase3-games.sql` adds the four ids to the `game_sessions.game_type` CHECK; `supabase-schema.sql` is updated for fresh installs. The migration was applied to the hosted Supabase project on 2026-11-10.

### Verified

- `server npm test` — **19/19 passing**: the Phase 1/2 suites plus Hive Mind fuzzy grouping and group-size scoring, a three-client socket playthrough of Hive Mind through the reveal, Odd One Out prompt privacy and catch scoring, Bluff real/self-vote/bluff scoring, Hot Takes minority/tie scoring, and the Phase 3 bank sizes.
- `client npm run build` — success; all game routes still compile.
- `client npx eslint src` — 0 errors, 7 pre-existing warnings.
- Hosted Supabase constraint — the four new ids and a legacy id (`most-likely-to`) all inserted into `game_sessions`; the temporary rows were deleted.
- Hosted persistence adapter — a temporary `hive-mind` session moved from `lobby` to `active` on `onStart` and to `finished` on `onEnd`, with `scores` and `current_round` stored; the row was deleted.

### Not verified / deferred

- No live browser playthrough at 375px or TV size; the four screens compile but were not visually inspected.
- A full socket game against the hosted database and a real two-browser session with the previous auth provider remain unverified; persistence was checked by invoking the adapter directly.
- Phase 4 games were not started at that point; they are recorded in the Phase 4 section above.

## Phase 2 — first four games and the TV display

### Shipped

- **Guess the Impostor** (`guess-impostor`) with original prompt banks and three working modes:
  - Classic (one impostor, 30s discussion), Double Agent (two impostors with 4+ players), and Blind (answers go straight to a vote).
  - Answer → discussion → vote → reveal. The impostor never receives the prompt in their private view; clues are anonymous until the reveal.
  - Crew score when the group catches an impostor; impostors score 2 each when they escape. A leaving impostor ends the round safely.
- **5 Second Challenge** (`five-second`) with typed answers and three working modes:
  - Classic (5s), Lightning (3s), Marathon (10s, six turns). One player answers, then the group judges “nailed it” or “not quite”.
  - Turn order rotates by seat; timeouts reveal a miss instead of hanging the room. The answerer cannot judge their own answer.
- **Overrated / Underrated** (`overrated-underrated`): five original opinion prompts, majority scoring, visible split percentages and voter breakdowns. Ties award everyone who voted.
- **Most Likely To** extracted into its own screen component; classic/anonymous modes unchanged.
- **Game routing:** the game page now selects a screen by `room.gameId`; the lobby catalogue contains only the four playable games. Parked games and their old modes remain hidden.
- **Read-only TV view (`/tv/[sessionId]`)**
  - A separate spectator socket calls `room:spectate`; it never takes a player seat, cannot act, and does not affect room state or host assignment.
  - Game modules expose `publicFor(room)`, so the TV never receives private state. In particular, the Impostor prompt is hidden on the TV until the reveal.
  - The display shows the lobby, round/timer, public clues and answers, live public results, and a scoreboard.
- **Prompt banks:** 70 original Impostor prompts, 80 original 5 Second prompts and 65 original Overrated prompts. No lore/profile data is read.

### Verified

- `server npm test` — **13/13 passing**: the Phase 1 socket suite plus spectator/no-seat/action rejection, Impostor secrecy and scoring, 5 Second turn ownership and timeout, Overrated majority/tie scoring, and prompt-bank size/id checks.
- `client npm run build` — success; `/tv/[sessionId]` is in the route manifest.
- `client npx eslint src` — 0 errors, 7 pre-existing warnings.
- TV public-view test confirms `you: null`, two player seats remain two, the spectator is tracked separately, and a spectator action returns `not_in_room`.

### Not verified / deferred

- Real two-browser authenticated play and visual review at 375px/TV sizes were not performed; the screens compile but were not opened in a browser.
- Live Supabase persistence is still exercised only with spies.
- Best Friend Test was later retired; Liars Bar, Higher/Lower, Avoid the Answer and the rest of Phase 4 were ported in the Phase 4 section above.

## Phase 1 — server-authoritative engine core

### Shipped

- **New engine (`server/engine/`)** with one `Room` per session that survives lobby → game → results → lobby.
  - Engine owns all phase transitions. Clients send intents only; they can no longer emit `next-round`.
  - One timer per room, armed from the game module's absolute `state.endsAt`, cleared on game end, restart and room delete.
  - Any member in the lobby can select game/mode and start; end, kick and restart remain host-only. Every action validates sender, phase and (optionally) idempotency key.
  - Per-player event ids (last 50) make duplicate clicks and retries no-ops.
  - Private views (`viewFor`) are computed per player; MLT anonymous mode hides voter names server-side.
- **Identity and reconnect**
  - Socket handshake verifies the previous auth provider's session JWT on the server when its secret is present.
  - Guests get an HMAC-signed guest token from `POST /api/auth/guest`; guest join is gated by `ALLOW_GUESTS` (default on outside production).
  - Players receive a signed reconnect token (24h) and a stable player id. Refreshing a tab reclaims the same seat and receives a full `room:sync` with private state.
  - Disconnects keep the seat for 30 seconds (configurable); only an explicit leave, kick, or grace expiry removes a player. Navigation never leaves a room.
- **Game plugin registry (`server/games/`)** — adding a game does not touch engine code. Each module declares `id`, `minPlayers`, `maxPlayers`, `modes`, `init`, `onEvent`, `onPhaseEnd`, `onPlayerLeave`, `viewFor`.
  - `most-likely-to` is public and fully playable (classic + anonymous).
  - `engine-stub` is hidden and exists only for engine verification.
- **Shared primitives (`server/engine/primitives/`)**: voting/tally, text normalisation + fuzzy matching, turn rotation, reveal/scoring, private view masking, server-timestamp reaction ranking.
- **Persistence adapter** writes session status, final scores (display-name keyed, as the existing schema expects), `game_started` / `game_finished` activity, and per-player `games_played` / `games_won`.
- **REST hardening**
  - Game routes require auth + group/session membership; the public `PATCH /api/games/:id` endpoint was removed (unused by the client).
  - Member profiles: members may edit themselves; only the host may edit another member. Target ids are checked against group membership.
  - Group reads require membership; nudges require auth + membership, and polling nudges is host-only. The sender name comes from the authenticated session, not the request body.
- **Client room layer**
  - `useRoom(sessionId)` + `roomStore` + an app-wide socket that survives route changes.
  - Reconnect token stored per session; the auth token is refreshed every 30s so socket reconnects keep working in long games.
  - Lobby and game pages no longer join/leave per page; lobby redirects to the game on start, game redirects back on restart.
- **UI**
  - Pastel party tokens (cream/lavender/baby blue/blush/mint/coral/grape/lime/sky) plus display/body fonts in `globals.css`.
  - Shared kit in `components/game/`: GameShell, PromptCard, TimerRing, AnswerInput, VoteButton, AvatarBubble, AnimatedResultBar, TierBadge, Leaderboard, RevealStack, ReactionBar, ConnectionBanner.
  - Rebuilt lobby: real player limits, any-member picker and start, only modes that change behaviour, concrete start-blocking reasons, kick, explicit leave.
  - New Most Likely To screens with vote → reveal → results, hidden votes during voting, classic voter reveal vs anonymous tally.
  - Loading, reconnecting and kicked states.

### Verified

- `server npm test` — 6/6 socket integration tests: 3 clients join; any-member start; host-only end; duplicate event id ignored; refresh reclaims the same seat and private state; server timer advances without client input; MLT plurality + anonymous voter masking; grace-period cleanup frees the room; unauthenticated socket rejected.
- `client npm run build` — success (Next.js 16.1.6, TypeScript).
- `client npx eslint src` — 0 errors, 7 pre-existing warnings.
- Server boot check on port 3999: `/api/health` returned `{status:"ok", engine:{rooms:0}}`.

### Not verified / deferred

- A real authenticated match between two browsers (no interactive sign-in was performed); the socket tests use signed guest identities.
- Live Supabase writes (the persistence adapter is injected and exercised with spies; no game was played against the hosted database).
- Mobile visual review at 375px and `/tv/[sessionId]` — deferred to the game UI phases.
- Bot/load-test script and the final README/plugin guide — final deliverables.
- Best Friend Test, Liars Bar, Higher/Lower, Avoid the Answer are parked and hidden (their old server modules remain for Phase 2 porting).
