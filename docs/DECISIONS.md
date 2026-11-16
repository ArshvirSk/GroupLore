# Decisions

Short records of choices made while rebuilding GroupLore. Each entry states the choice and why.

## Project / tooling

- **Initialised a git repository in the project root.** The repo had no git metadata, and the phase plan requires one commit per phase. The original client folder was its own single-commit Create Next App repository with no remote; its `.git` was moved to `.git-archive-` (gitignored) instead of deleted, so its history is preserved on disk.
- **Server stays JavaScript with JSDoc contracts.** The existing server is ESM JavaScript; changing the runtime to TypeScript would be a large, unrelated migration. The `GameModule` contract is documented in `server/engine/engine.js` and enforced at registration.
- **Tests use `node:test` + a small SSE/POST harness.** No test framework or Socket.io dependency is used.

## Engine semantics

- **Room is created from the persisted game session on first join.** The session row already knows the group, so this avoids coupling Express routes to an engine singleton and makes the engine testable with an injected `loadSession`.
- **Player identity is stable per user/guest, not per socket.** A second join with the same Supabase user (or guest token) rebinds the existing seat. Opening a second tab replaces the old socket instead of creating a second player.
- **Reconnect token is signed and scoped to one session + player.** It is stored in localStorage per room. Identity fallback also allows a refresh without the token while the server still has the room.
- **30-second disconnect grace.** Long enough for a refresh or tunnel, short enough that a dead seat does not stall the lobby. Grace is configurable for tests.
- **All phases are timed.** A module must set `state.endsAt`; the engine calls `onPhaseEnd` at that absolute time. If a module forgets, the engine adds a 3-second fallback so a room cannot hang. There is no client-driven advance.
- **Any member in the lobby can start.** Game selection and start are no longer host-only; a party game should not stall because the host is in another tab. End, kick and restart remain host-only moderation actions.
- **There is no ready gate.** Requiring every non-host to tap Ready added a collective pause without protecting anything; the connected-player and game-minimum checks are enough. Readiness fields remain in the room view for compatibility but are no longer enforced.
- **Anonymous MLT means the tally is public but voter names are not.** Classic reveals voter → target pairs at the end. This is a real behavioural difference rather than a renamed classic mode.
- **MLT requires 3 players.** With two players a plurality vote is trivial; three is the minimum for the mechanic to mean anything.
- **Scores live in room state keyed by playerId, and are persisted keyed by display name.** The database column and the Hub were built around display names; keying room state by id avoids duplicate-name collisions during play.
- **Persistence is best-effort and never blocks a phase.** Failures are logged; a Supabase outage does not freeze a game.

## Auth / policy

- **Guests are signed tokens, not anonymous sockets.** `ALLOW_GUESTS` enables them. Guests choose a display name and receive a server-signed identity; the socket layer never trusts a client-supplied id.
- **Guest entry is limited to existing open lobbies.** A 6-character invite code resolves only the group name and lobby; guests cannot create or join groups, open lobbies, see group history, or access the dashboard. This keeps anonymous identity out of the persistent membership model while still letting a friend fill a seat.
- **Guest play is a deployment choice.** `ALLOW_GUESTS=false` disables the guest-token endpoint and the invite screen shows the sign-in path instead. Guest joins are allowed by the engine only when the deployment opts in.
- **Supabase display names come from the database row** when available; the client-supplied name is only a fallback. This prevents a signed-in user from impersonating another member by editing the handshake payload.
- **Nudge polling is host-only.** Sending a nudge requires group membership and the sender name is taken from the Supabase-authenticated user, not `req.body.from`.
- **Removed `PATCH /api/games/:id`.** It let any authenticated user write arbitrary columns on any session and had no client caller.

## Client

- **One app-wide realtime connection, no disconnect on unmount.** `useRoom` only detaches listeners. This is the direct fix for the original `leave-lobby` navigation bug.
- **Lobby and game are separate routes that redirect based on `room.phase`.** This keeps the URL shareable without duplicating room state or creating a provider that spans route groups.
- **Deleted `src/lib/socket.ts` and `src/stores/gameStore.ts`.** They encoded the old per-page realtime contract and had no remaining importers.
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
- **Phase 3 game ids required a database migration.** The original CHECK constraint only knew the eight legacy ids; `supabase/migrations/supabase-migration-phase3-games.sql` has been applied to the hosted project and is included for other environments.

## Phase 4 games

- **Best Friend Test is retired.** It depends on `member_profiles`, and current games deliberately do not read lore. Porting it would either revive profile coupling or leave a game that cannot start for most groups. The legacy `best-friend-test` id remains in the database CHECK so old rows are still valid.
- **Liars Bar uses a standalone truth/lie bank.** The storyteller gets both statements, chooses one, and the group votes. The group scores when its majority reads the choice correctly; the storyteller scores 2 when it does not. The choice is hidden until the reveal.
- **Higher/Lower derives its ranking from in-room ratings.** The old version used profile stats that current games no longer read. Every player rates every other player 1–10, the server averages those ratings, and the room then calls higher/lower. This keeps the mechanic social and independent of stored profiles.
- **Avoid the Answer uses a secret-word/banned-word bank.** The describer sees the target and the banned words; everyone else sees only options. The server rejects clues containing the target or any banned word rather than trusting the client. A correct guess scores the guesser 2 and the describer 1.
- **Caption This hides authorship until the vote.** Captions are shuffled into anonymous choices, and voting for your own caption is rejected. Authors score 1 per vote received; the reveal shows authorship and voters.
- **Wavelength scores the group average, not only individual guesses.** Each guesser scores 2 within 10 points and 1 within 20. The clue giver is scored against the average guess, so one wild guess cannot erase an otherwise good clue. The target is private to the clue giver and omitted from `publicFor`.
- **Category Rush merges normalized duplicates.** Answers are grouped with the shared text normalizer, unique groups score 2 and shared groups 1, and the server enforces the required starting letter. This makes matching the group safe but less rewarding than a unique valid answer.
- **All seven Phase 4 games implement `publicFor`.** The TV gets only public phases and reveal data; Liars Bar's unchosen statement, Wavelength's target, Avoid the Answer's target and Caption This's authors are never sent early.
- **Phase 4 needs a database migration.** `supabase/migrations/supabase-migration-phase4-games.sql` expands the `game_sessions.game_type` CHECK. It was applied to the hosted project on 2026-11-11 and verified with a three-user hosted start of every game; fresh installs use the updated `supabase/schema.sql`.

## Supabase Auth

- **Supabase Auth replaces Clerk; there is no parallel identity provider.** The browser owns the Supabase session, REST calls carry its access token as a bearer token, and the realtime SSE stream carries the same token. The server verifies every token with `supabase.auth.getUser`.
- **`users.auth_user_id` is the app-side link to `auth.users.id`.** It is not a password hash or a second auth system; it exists so app rows keep stable UUIDs while auth identities can be replaced.
- **Existing users are linked by email on first sync.** `supabase/migrations/supabase-migration-supabase-auth.sql` copies the old external id into `auth_user_id`; the first sign-in updates that row to the Supabase user id, preserving groups and stats.
- **Page protection is client-side; data protection is server-side.** There is no auth middleware. The dashboard and group pages redirect signed-out visitors, while every REST route and realtime stream verifies the Supabase token authoritatively.
- **Email confirmation is disabled for the hosted project.** Sign-up returns a session immediately, so there is no confirmation-link step in the normal flow. The client still handles a no-session response instead of assuming success if another environment enables confirmation.
- **App tables are server-only.** RLS is enabled on every app table and direct grants to `anon` and `authenticated` are revoked. The browser's anon key is only for Supabase Auth; the Next.js server uses the service role, which bypasses RLS.

## Start flow

- **Creating a group opens its first lobby immediately.** The group still exists as the persistent container for membership, history and stats, but the user no longer has to visit the group page and press Open Lobby as a second setup step. A group is created for its first room and the room opens in the same action.
- **The lobby is a dark-shell room, not a separate pastel app.** The dashboard, group page and lobby now share the same shell and typography; game screens keep their own play surfaces. This removes the visual context switch when entering a room.
- **The active room code is the group join code.** A group can have only one open lobby, so adding `game_sessions.join_code` would duplicate a value that already resolves the room. `/join/CODE`, `/guest` and the lobby invite all point at the same code; a rotating per-session code would need a migration if rooms ever become concurrent.
- **Invite URLs are `/join/:code`.** The route joins an existing member idempotently, sends signed-out visitors through auth with a safe `next` path, then opens the live lobby if one exists or the group page otherwise.
- **The dashboard owns group creation.** Sending a signed-in user back to the marketing page to create a group was an unnecessary loop; the dashboard now expands an inline form and group cards can open a lobby directly.
- **A session's default game is selected when its room loads.** New sessions are created with `most-likely-to`, so a fresh lobby has a valid selected game and a startable default instead of making every room begin with an empty game picker.
- **Minimum-player information is shown before selection.** Game cards display how many more players are needed, and the selected game's invite prompt makes the gap explicit. Lobby invites copy the shareable join URL.

## Known limitations

- Rooms are in-memory and single-process. A server restart loses live state; a reconnect after restart starts a fresh room from the session row (or is rejected if the session is finished). Horizontal scaling needs a Redis adapter and shared room storage, which is out of Phase 1.
- The 30s grace means a closed tab can hold a lobby seat for up to 30 seconds.
- The Hub's other stat columns and badges remain driven by the old event types; only games played/won are written so far.
- The TV route requires a signed-in group member to authenticate the spectator socket; it is not an unauthenticated public display URL yet.
- A game screen is compiled but has not been visually exercised at 375px or on a TV-sized viewport.
- A full socket game against the hosted database has not been run; persistence is verified through the adapter and direct hosted-table checks.

## Roadmap features

- **Recaps are per finished game, not per session row.** A room can return to the lobby and play again, so `session_recaps.session_id` is indexed rather than unique and every recap gets its own timestamped share id.
- **Share cards are public by share id only.** They expose display names, scores and selected public answer text; group membership and profile data are not included.
- **Progression is group-scoped.** Elo ratings are stored per group and game, while rivalries are pairwise and achievements are milestones. This keeps a player's record in one friend group separate from another.
- **Lore generation is local and deterministic.** No profile text is sent to a model. Generation requires explicit owner opt-in, approval is a separate owner action, and the engine only receives the latest approved pack when `LORE_MODE=true`. Most Likely To falls back to its static bank when no valid pack exists.
- **Moderation is layered.** Hosts can mute, kick or block (block also prevents rejoining), reports persist before being acknowledged, profanity is rejected at the engine boundary, and a deployment content ceiling plus NSFW gate selects age-appropriate banks.
- **PWA support is network-first.** The service worker exists for installability but never caches realtime or API responses; QR joins use the existing `/join/:code` route.
- **Daily challenges are UTC-seeded and stateless; group progress is read from finish events.** Blur Guess and Connections derive the same puzzle from the calendar date, so the puzzle itself needs no daily row, cron job, or selection service. Per-group completion and streaks are derived from completed `activity_log` `game_finished` events whose payload has `gameMode = 'daily'` (host-ended or errored games do not count), deduplicated by UTC completion date. Replays create more finish events but count as one day, so replays stay open and no separate completion ledger or migration is needed.

## Card games and content scale

- **`MODES.md` is absent in this repository.** The card work follows `MODES_2.md`, the shipped engine contract and the existing game modules instead. This is a documented deviation from the request, not a missing game rule.
- **Shared card UI lives in `src/components/cards/`, not `client/src/components/cards/`.** This project has no `client/` tree; the Next.js app is rooted at `src/`.
- **Liars Bar keeps the `liars-bar` id but replaces the statement mechanic.** The deck scales in 20-card sets (6 Kings, 6 Queens, 6 Aces, 2 Jokers) so 3–8 players can each hold five cards; a single 20-card set cannot supply eight five-card hands. Table ranks rotate K → Q → A per round.
- **Liars Bar is 3–8 players, not 3–12.** Eight seats are the largest table the five-card hand and 25-second turn clock can support comfortably. Classic uses three strikes and Quick uses one.
- **A Liars Bar call is judged on every card in the last play.** Jokers are wild and a Joker-only claim is honest. A caught liar takes the strike; an honest claim gives the caller the strike. Empty hands can only call.
- **Cheat resets the claim to A after a challenge.** The player who did not pick up the pile starts the next sequence; this keeps the pickup consequence visible and gives the winner of the exchange the lead.
- **Cheat Quick uses a 30-card deck** (three copies each of A–10). Classic uses the full 52-card deck. Emptying a hand wins immediately.
- **Skull Duel is an original theme, not a branded copy.** Classic is first to two clean challenges, Quick is first to one. Tied high bids go to the earliest seat in join order; this avoids a second bidding loop and keeps the turn clock bounded.
- **Blackjack Showdown uses a three-deck shoe, fixed 10-chip ante and 200 starting chips over eight rounds.** A natural pays 3:2, a push returns the ante, and the dealer stands on all 17s. Chips are the room score and the final ranking.
- **Higher/Lower Deck mode treats exact ties as pushes.** A tie scores nothing but preserves the streak; correct calls multiply by the current streak up to ×5. The shoe reshuffles when empty. This rule is shown in the UI rather than left implicit.
- **The Fill the Blank judge must flip an anonymous entry before picking it.** This preserves the face-down submission fiction and prevents accidental picks from unread cards.
- **Content targets are not all met in this change.** The audit baseline showed a 19,921-item gap, with some targets (Wordle Race 2,000, Buzzer Trivia 2,500, Fact or Fiction 1,500) larger than a reliable authoring batch for one change. Banks were left honest rather than padded with low-quality or inaccurate filler. Missing metadata (tags/difficulty/rating) is reported by the validator as warnings; bank size and structural failures remain errors.
- **Selection memory is server-only.** `seen_items` has RLS enabled and no client policies; `scope_id` is the group id when present, otherwise the lobby/session id. Pruning is a server responsibility rather than a cron-only rule.
- **Content controls and full per-game migration to `pickItems` are not complete.** The shared selector, filters and migration are in place, but not every legacy game has been rewired yet. This is called out in the final report instead of claiming full coverage.

## Pattern diversity, metadata and zero-blank prompts

- **Pattern diversity is now a validator error, not advisory output.** The validator normalises each prompt to its first four words and fails any stem used by more than 3% of a bank. Trivia and Fact or Fiction also cap one semantic question family (capital, chemical symbol, creator, year, count, superlative) at 8%; Flag and Emoji Decode use 12%. The top ten stems for each failing bank are printed so rewrites can target the real offenders.
- **Legacy metadata was backfilled mechanically, then checked structurally.** Every bank item now has tags and a rating. `all` is the default rating; `spicy` is preserved only where it already existed. Tags combine a stable bank tag with topic keywords rather than inventing per-item difficulty.
- **Zero-blank Fill the Blank prompts answer with one card.** Several legacy prompts carry `blanks: 0` but the play phase already needs one card. `normalizePrompt` maps zero/undefined to one, so the engine, judge hand limit and submit button agree. A regression test covers the normaliser and every initialised round.
- **Stem rewrites keep the original joke or question.** Offending Roast, Acronym and Fill prompts were reordered so the specific place or object leads the sentence (for example, "A hotel bed: the worst thing to find"), preserving meaning while removing repeated opening stems. No bank was shrunk.
- **Some template-driven banks still need content work.** The new check exposes inherent repetition in Most Likely To, Five Second, Hive Mind, Impostor, Odd One Out, Survey Says, Buzzer Trivia and Fact or Fiction. These are reported as failing errors rather than exempted; fixing them by reordering alone would produce worse prompts, so they remain part of the content backlog.

## Prompt-diversity clearance and Buzzer expansion

- **Prompt-stem rewrites use the question's own subject as the opening.** Most Likely To prompts became "Who would …?", Name prompts became direct questions such as "What's a pizza topping?", and list prompts with a place became "In a hotel room, what's something?". This removes repeated first-four-word stems without changing the answer space.
- **Buzzer Trivia's capital and symbol families were diluted by replacement, not by deleting the bank.** Excess capital and chemical-symbol questions were replaced with varied geography, science, history and arts questions. The remaining 24 capital and 9 symbol questions stay inside the trivia family cap at the bank's larger size.
- **The template-family check covers the families named in the request, not every possible superlative.** Capital, chemical symbol, creator and year remain capped; count and superlative were removed from the checker because general-knowledge banks legitimately use them across unrelated subjects.
- **The first science/nature content batch adds 50 Buzzer Trivia questions.** It covers astronomy, anatomy, geology, units and animals, with answers written only where confidence was high. The bank is now 350 of 2,500, so the remaining 2,150-item shortfall is still open.

## Playable-bank gating and factual verification

- **Lobby availability is derived from loaded content, not a hardcoded list.** `bankStatus.js` maps content-driven games to their loaded bank and reports `playable` when the bank can fill a round. The catalog exposes `available`, lobby cards are disabled with Coming soon, and both engine selection and the lobby start route reject unavailable games.
- **Factual banks now require `confidence: "high"`.** `scripts/verify-factual.ts` checks answer presence and normalized answer integrity, true/false explanations, eight-answer survey boards, four-group Connections puzzles, ambiguity wording and time-sensitive wording. Failing items are removed to `docs/review-queue.md` rather than shipped.
- **Independent semantic re-derivation is not automated.** The repository has no authoritative answer source or model-backed verifier, so the gate enforces structural and editorial invariants instead of pretending to re-solve each question. The current four factual banks pass with zero removals; new batches must run the script before validation.
- **The empty-bank path is tested through a loaded-bank override.** The engine test selects a real game, replaces its bank with an empty array, and asserts start fails with `game_unavailable`.

## Fact or Fiction nature batch

- **Added 50 confidence-tagged statements (25 true/false pairs) on science and nature.** The batch uses stable, non-time-sensitive facts, includes explanations, and keeps the bank's true/false balance even. Duplicate statements found by the validator were replaced rather than shipped twice.
- **Spot-check samples are seeded and stratified.** Factual banks show five seeded random items plus five hardest items (difficulty, then prompt length), while other banks keep five seeded random items.

## Status audit, blind verification and launch policy

- **`MODES.md` is absent from this checkout.** `docs/STATUS.md` is generated from the registry, engine files, client routing, tests and loaded banks; MODES.md-only rows use the game names in the execution brief and the repository's tracked bank targets.
- **Launch minimum is a policy, not a stretch target.** `launchPolicy.js` defines consumed items per session × 10, floored at 150 and capped at 400. The audit now reports launch and stretch gaps separately. Existing lobby gating still uses the smaller non-empty-bank minimum until each bank reaches launch size.
- **Blind verification separates export, answering and comparison.** `export-blind.ts` writes answer-stripped chunks; `compare-blind.ts` refuses to remove items for a bank until every chunk has an answers file. Exporting does not count as verification, and the structural gate remains separate.
- **Missing games are not being faked with placeholder banks.** The 18 missing rows in `docs/STATUS.md` have no engine, client screen or bank. They require vertical slices, not JSON alone.

## Blind accuracy gate executed

- **All four factual banks were re-answered from answer-stripped chunks.** Each chunk was answered from the exported question/word list only, before comparison read the stored bank. Buzzer answers used the normalizer's exact string matching; Fact or Fiction answered true/false independently; Survey Says supplied eight-answer boards; Connections solved all 100 word grids by category families.
- **Survey Says comparison requires a majority board, not an identical board.** The first exact-set run removed 136/150 items, mostly for one- or two-word differences such as `tv`/`television`; that measured wording, not accuracy. A board now passes when the blind answer reproduces at least 5 of the 8 stored entries. This is recorded as still stricter than a subjective plausibility check, and it leaves unverifiable boards removable.
- **Exact removals:** Buzzer Trivia 5/350 (`buzz-033`, `buzz-040`, `buzz-254`, `buzz-290`, `buzz-304`), Fact or Fiction 0/350, Survey Says 42/150, Connections 0/100. Remaining banks are 345, 350, 108 and 100 respectively. Every removed item and mismatch score is in `docs/review-queue.md`.
- **The Buzzer removals are alias or precision mismatches, not proven false statements.** They are removed because they failed independent reproduction; adding aliases or rewording them is content work, not a reason to keep them in the verified bank.
- **Question-only exports remain as evidence.** `docs/blind/*.json` stays next to the matching `*.answers.json` files so the gate can be rerun. `compare-blind.ts` now ignores answer files when enumerating chunks, which fixes an earlier `.answers.answers.json` bug.
