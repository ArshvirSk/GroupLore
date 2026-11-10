# Changelog

All phase work is recorded here with what was verified and what was deferred.

## Phase 1 — server-authoritative engine core

### Shipped

- **New engine (`server/engine/`)** with one `Room` per session that survives lobby → game → results → lobby.
  - Engine owns all phase transitions. Clients send intents only; they can no longer emit `next-round`.
  - One timer per room, armed from the game module's absolute `state.endsAt`, cleared on game end, restart and room delete.
  - Host-only actions: select game/mode, start, end, kick, restart. Every action validates sender, phase and (optionally) idempotency key.
  - Per-player event ids (last 50) make duplicate clicks and retries no-ops.
  - Private views (`viewFor`) are computed per player; MLT anonymous mode hides voter names server-side.
- **Identity and reconnect**
  - Socket handshake verifies the Clerk session JWT with `@clerk/backend` when `CLERK_SECRET_KEY` is present.
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
  - Group reads require membership; nudges require auth + membership, and polling nudges is host-only. The sender name comes from Clerk, not the request body.
- **Client room layer**
  - `useRoom(sessionId)` + `roomStore` + an app-wide socket that survives route changes.
  - Reconnect token stored per session; Clerk token refreshed every 30s so socket reconnects keep working in long games.
  - Lobby and game pages no longer join/leave per page; lobby redirects to the game on start, game redirects back on restart.
- **UI**
  - Pastel party tokens (cream/lavender/baby blue/blush/mint/coral/grape/lime/sky) plus display/body fonts in `globals.css`.
  - Shared kit in `components/game/`: GameShell, PromptCard, TimerRing, AnswerInput, VoteButton, AvatarBubble, AnimatedResultBar, TierBadge, Leaderboard, RevealStack, ReactionBar, ConnectionBanner.
  - Rebuilt lobby: real player limits, host-only picker, only modes that change behaviour, ready gate enforced on the server, disabled Start with a concrete reason, kick, explicit leave.
  - New Most Likely To screens with vote → reveal → results, hidden votes during voting, classic voter reveal vs anonymous tally.
  - Loading, reconnecting and kicked states.

### Verified

- `server npm test` — 6/6 socket integration tests: 3 clients join; host gating; ready gating; non-host start/end rejected; duplicate event id ignored; refresh reclaims the same seat and private state; server timer advances without client input; MLT plurality + anonymous voter masking; grace-period cleanup frees the room; unauthenticated socket rejected.
- `client npm run build` — success (Next.js 16.1.6, TypeScript).
- `client npx eslint src` — 0 errors, 7 pre-existing warnings.
- Server boot check on port 3999: `/api/health` returned `{status:"ok", engine:{rooms:0}}`.

### Not verified / deferred

- A real Clerk sign-in match between two browsers (no interactive sign-in was performed); the socket tests use signed guest identities.
- Live Supabase writes (the persistence adapter is injected and exercised with spies; no game was played against the hosted database).
- Mobile visual review at 375px and `/tv/[sessionId]` — deferred to the game UI phases.
- Bot/load-test script and the final README/plugin guide — final deliverables.
- Best Friend Test, Liars Bar, Higher/Lower, Avoid the Answer are parked and hidden (their old server modules remain for Phase 2 porting).
