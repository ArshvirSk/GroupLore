# Decisions

Short records of choices made while rebuilding GroupLore. Each entry states the choice and why.

## Project / tooling

- **Initialised a git repository in the project root.** The repo had no git metadata, and the phase plan requires one commit per phase. The original client folder was its own single-commit Create Next App repository with no remote; its `.git` was moved to `.git-archive-client/` (gitignored) instead of deleted, so its history is preserved on disk.
- **Server stays JavaScript with JSDoc contracts.** The existing server is ESM JavaScript; changing the runtime to TypeScript would be a large, unrelated migration. The `GameModule` contract is documented in `server/engine/engine.js` and enforced at registration.
- **Tests use `node:test` + `socket.io-client`.** No test framework dependency was added. `socket.io-client` is a dev dependency only.

## Engine semantics

- **Room is created from the persisted game session on first join.** The session row already knows the group, so this avoids coupling Express routes to an engine singleton and makes the engine testable with an injected `loadSession`.
- **Player identity is stable per user/guest, not per socket.** A second join with the same Supabase user (or guest token) rebinds the existing seat. Opening a second tab replaces the old socket instead of creating a second player.
- **Reconnect token is signed and scoped to one session + player.** It is stored in localStorage per room. Identity fallback also allows a refresh without the token while the server still has the room.
- **30-second disconnect grace.** Long enough for a refresh or tunnel, short enough that a dead seat does not stall the lobby. Grace is configurable for tests.
- **All phases are timed.** A module must set `state.endsAt`; the engine calls `onPhaseEnd` at that absolute time. If a module forgets, the engine adds a 3-second fallback so a room cannot hang. There is no client-driven advance.
- **Start gate is stricter than the old app:** game selected, player count within the module's min/max, all players connected, and every non-host ready. The host does not ready up. The lobby shows the exact blocking reason.
- **Anonymous MLT means the tally is public but voter names are not.** Classic reveals voter → target pairs at the end. This is a real behavioural difference rather than a renamed classic mode.
- **MLT requires 3 players.** With two players a plurality vote is trivial; three is the minimum for the mechanic to mean anything.
- **Scores live in room state keyed by playerId, and are persisted keyed by display name.** The database column and the Hub were built around display names; keying room state by id avoids duplicate-name collisions during play.
- **Persistence is best-effort and never blocks a phase.** Failures are logged; a Supabase outage does not freeze a game.

## Auth / policy

- **Guests are signed tokens, not anonymous sockets.** `ALLOW_GUESTS=false` disables them. They default to on outside production so local play and the socket tests work without an account.
- **Guest tokens do not prove group membership.** In production guests should be disabled; with guests enabled, a guest can join a room whose session exists. This is documented rather than silently pretending guests are members.
- **Supabase display names come from the database row** when available; the client-supplied name is only a fallback. This prevents a signed-in user from impersonating another member by editing the handshake payload.
- **Nudge polling is host-only.** Sending a nudge requires group membership and the sender name is taken from the Supabase-authenticated user, not `req.body.from`.
- **Removed `PATCH /api/games/:id`.** It let any authenticated user write arbitrary columns on any session and had no client caller.

## Client

- **One app-wide socket, no disconnect on unmount.** `useRoom` only detaches listeners. This is the direct fix for the original `leave-lobby` navigation bug.
- **Lobby and game are separate routes that redirect based on `room.phase`.** This keeps the URL shareable without duplicating room state or creating a provider that spans route groups.
- **Deleted `client/src/lib/socket.ts` and `client/src/stores/gameStore.ts`.** They encoded the old per-page socket contract and had no remaining importers.
- **Only engine games appear in the lobby.** During Phase 1 that means Most Likely To only; all fake mode pills are gone. Parked games will reappear as they are ported.
- **Lore is untouched but unused.** `member_profiles`, the editor and the Hub stay in place; `LORE_MODE` (default off) is the only switch that may re-enable lore prompts later. No current game reads profiles.

## Phase 2 games

- **Original prompt banks replace profile-derived prompts.** Lore/profile prompts are deferred, so Impostor, 5 Second and Overrated use standalone original JSON banks. No game reads `member_profiles`.
- **5 Second asks for one typed answer, then the group judges it.** The original asks a player to name three things out loud; requiring three typed items in five seconds is unfair on mobile. One answer plus a nailed/missed vote preserves the pressure and the social judging loop.
- **Hot Seat was dropped.** The original repeated the same player for three turns; with a fixed nine-round count, players beyond the first few seats never got a turn. Shipping only modes that give every player a fair turn is better than a visible mode with a partial rotation.
- **Impostor answers are clues, and all clues are anonymous until the reveal.** The prompt is secret, so the answer phase is a clue, not the full answer. Showing authors during discussion would make the deduction trivial.
- **A leaving impostor ends the game.** The round no longer has a secret role to deduce; continuing would leak or corrupt the result. A non-impostor leaving is handled by removing their answer/vote and continuing.
- **Overrated ties award every voter a point.** A tie has no majority to reward; giving both sides a point avoids punishing a legitimate split.
- **TV is a spectator, not a player.** Spectators use their own socket and `room:spectate`, are tracked separately from seats, cannot act, and receive `publicFor` instead of a player view. The TV therefore cannot change readiness, take a host slot, or see the Impostor prompt early.
- **Game modules own public-view redaction.** The engine does not guess which fields are safe. Each module implements `publicFor`; the TV never receives `viewFor` output.

## Phase 3 games

- **Hive Mind and Odd One Out share one 150-pair bank.** Each entry has a crew `text` and a related `odd` prompt. Hive Mind uses `text`; Odd One Out gives `odd` to one player. This keeps the two games' content consistent without shipping two near-duplicate banks.
- **Odd One Out is a social-deduction game, not a trivia quiz.** One player gets a related prompt instead of the same one, answers are anonymous, and the room votes for the odd player. A four-player minimum gives the odd player enough cover.
- **Odd One Out prompts are private per player and hidden on the TV.** The private view returns only the viewer's prompt; `publicFor` returns neither prompt until the reveal. A TV in the room must not reveal the odd prompt to the odd player.
- **Bluff's real answer is server-owned.** Players never receive it during the writing phase, so the only way to vote correctly is knowledge or a good read. Duplicate normalized bluffs are merged; a bluff that exactly matches the real answer is removed and scores 1.
- **Bluff scoring rewards both fooling and detecting.** Real-answer voters get 2, bluff authors get 1 per vote their bluff receives, and exact real answers get 1. Self-votes are rejected rather than silently discarded.
- **Hot Takes rewards the minority.** The minority side gets 2 and the majority 1; ties and unanimous votes give everyone 1. The game is about backing the less popular take without making consensus worthless.
- **All exposed modes have a real timer or behavior difference.** No placeholder mode pills were added; Bluff Quick changes both round count and timings, and Hot Takes Slow Burn changes the voting window.
- **Phase 3 game ids required a database migration.** The original CHECK constraint only knew the eight legacy ids; `supabase-migration-phase3-games.sql` has been applied to the hosted project and is included for other environments.

## Phase 4 games

- **Best Friend Test is retired.** It depends on `member_profiles`, and current games deliberately do not read lore. Porting it would either revive profile coupling or leave a game that cannot start for most groups. The legacy `best-friend-test` id remains in the database CHECK so old rows are still valid.
- **Liars Bar uses a standalone truth/lie bank.** The storyteller gets both statements, chooses one, and the group votes. The group scores when its majority reads the choice correctly; the storyteller scores 2 when it does not. The choice is hidden until the reveal.
- **Higher/Lower derives its ranking from in-room ratings.** The old version used profile stats that current games no longer read. Every player rates every other player 1–10, the server averages those ratings, and the room then calls higher/lower. This keeps the mechanic social and independent of stored profiles.
- **Avoid the Answer uses a secret-word/banned-word bank.** The describer sees the target and the banned words; everyone else sees only options. The server rejects clues containing the target or any banned word rather than trusting the client. A correct guess scores the guesser 2 and the describer 1.
- **Caption This hides authorship until the vote.** Captions are shuffled into anonymous choices, and voting for your own caption is rejected. Authors score 1 per vote received; the reveal shows authorship and voters.
- **Wavelength scores the group average, not only individual guesses.** Each guesser scores 2 within 10 points and 1 within 20. The clue giver is scored against the average guess, so one wild guess cannot erase an otherwise good clue. The target is private to the clue giver and omitted from `publicFor`.
- **Category Rush merges normalized duplicates.** Answers are grouped with the shared text normalizer, unique groups score 2 and shared groups 1, and the server enforces the required starting letter. This makes matching the group safe but less rewarding than a unique valid answer.
- **All seven Phase 4 games implement `publicFor`.** The TV gets only public phases and reveal data; Liars Bar's unchosen statement, Wavelength's target, Avoid the Answer's target and Caption This's authors are never sent early.
- **Phase 4 needs a database migration.** `supabase-migration-phase4-games.sql` expands the `game_sessions.game_type` CHECK. It has not yet been applied to the hosted project; fresh installs use the updated `supabase-schema.sql`.

## Supabase Auth

- **Supabase Auth replaces Clerk; there is no parallel identity provider.** The browser owns the Supabase session, REST calls carry its access token as a bearer token, and the socket handshake carries the same token. The server verifies every token with `supabase.auth.getUser`.
- **`users.auth_user_id` is the app-side link to `auth.users.id`.** It is not a password hash or a second auth system; it exists so app rows keep stable UUIDs while auth identities can be replaced.
- **Existing users are linked by email on first sync.** `supabase-migration-supabase-auth.sql` copies the old external id into `auth_user_id`; the first sign-in updates that row to the Supabase user id, preserving groups and stats.
- **Page protection is client-side; data protection is server-side.** There is no auth middleware. The dashboard and group pages redirect signed-out visitors, while every REST route and socket handshake verifies the Supabase token authoritatively.
- **Email confirmation is controlled by Supabase.** If the project enables it, sign-up returns no session and the UI asks the user to confirm; if disabled, sign-up signs the user in immediately.
- **App tables are server-only.** RLS is enabled on every app table and direct grants to `anon` and `authenticated` are revoked. The browser's anon key is only for Supabase Auth; the Express API uses the service role, which bypasses RLS.

## Known limitations

- Rooms are in-memory and single-process. A server restart loses live state; a reconnect after restart starts a fresh room from the session row (or is rejected if the session is finished). Horizontal scaling needs a Redis adapter and shared room storage, which is out of Phase 1.
- The 30s grace means a closed tab can hold a lobby seat for up to 30 seconds.
- The Hub's other stat columns and badges remain driven by the old event types; only games played/won are written so far.
- The TV route requires a signed-in group member to authenticate the spectator socket; it is not an unauthenticated public display URL yet.
- A game screen is compiled but has not been visually exercised at 375px or on a TV-sized viewport.
- A full socket game against the hosted database has not been run; persistence is verified through the adapter and direct hosted-table checks.
