# GroupLore 🎲

> **Real-time multiplayer party games, personalized for your friend group.**

Inside jokes, embarrassing habits, iconic moments — turned into multiplayer chaos.

---

## Architecture

```
GroupLore/
├── src/app/               # Landing, dashboard, group, lobby, game, guest
├── src/app/api/           # REST + SSE realtime route handlers
├── src/components/        # Shared UI + game screens
├── src/stores/            # Zustand auth and room stores
├── src/lib/               # Supabase, API, realtime, lobby helpers
├── src/server/            # Engine, games, data, and server libraries
├── docs/                  # Design, deployment, and development docs
├── supabase/              # Schema + ordered migrations
└── deploy/                # systemd and nginx templates
```

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | Next.js 16, Tailwind CSS v4, Framer Motion, Zustand |
| Backend   | Next.js route handlers + process-wide game engine |
| Database  | Supabase (PostgreSQL)                               |
| Auth      | Supabase Auth (email/password + anonymous guests)   |
| Real-time | Server-Sent Events + authenticated POST actions     |

## Games

All games below are playable through the server-authoritative engine. Every game reads only its own prompt bank, not `member_profiles`.

Most games support **3–12 players**. **Odd One Out** requires **4–12**; **Mad Libs Chaos** supports **3–9**. Modes are selected in the lobby.

| Game | Players | Modes |
| ---- | ------- | ----- |
| 👑 **Most Likely To** | 3–12 | **Classic** — secret votes until the reveal; **Anonymous** — tally only, voter names hidden |
| 🕵️ **Guess the Impostor** | 3–12 | **Classic** — one impostor, 30 seconds of clues; **Double Agent** — two impostors with 4+ players; **Blind** — no discussion, straight to the vote |
| ⚡ **5 Second Challenge** | 3–12 | **Classic** — five seconds, then the group judges; **Lightning** — three seconds; **Marathon** — ten seconds, six turns |
| ⚖️ **Overrated / Underrated** | 3–12 | **Classic** — five items, twelve seconds to pick a side |
| 🍸 **Liars Bar** | 3–12 | **Classic** — five statements, twenty seconds to choose and vote; **Quick** — three faster rounds |
| 📈 **Higher / Lower** | 3–12 | **Classic** — rate the room, then six calls; **Quick** — faster poll and four calls |
| 🚫 **Avoid the Answer** | 3–12 | **Classic** — forty-five seconds without the banned words; **Blitz** — three fast rounds |
| 🔀 **Would You Rather** | 3–12 | **Classic** — majority takes the point; **Minority Rules** — the smaller side scores two |
| 📸 **Caption This** | 3–12 | **Classic** — four scenarios, thirty seconds each; **Quick** — three faster rounds |
| 🌊 **Wavelength** | 3–12 | **Classic** — one clue giver and a secret point on the spectrum; **Quick** — three faster rounds |
| 💡 **Category Rush** | 3–12 | **Classic** — five categories, twenty seconds; **Speed** — ten seconds |
| 🐝 **Hive Mind** | 3–12 | **Classic** — five prompts, twenty seconds to agree; **Speed** — ten seconds |
| 🎭 **Odd One Out** | 4–12 | **Classic** — one related prompt to find through discussion and voting; **Blind** — straight to the vote |
| 🎩 **Bluff** | 3–12 | **Classic** — write a fake, then spot the real answer; **Quick** — three faster rounds |
| 🌶️ **Hot Takes** | 3–12 | **Classic** — six takes, twelve seconds to pick a side; **Slow Burn** — twenty seconds |
| 🔥 **Roast Battle** | 3–12 | **Classic** — three rounds of anonymous head-to-head answers; **Quick** — two faster rounds |
| 🔤 **Acronym Wars** | 3–12 | **Classic** — five rounds, 40 seconds to expand the letters; **Speed** — 20 seconds |
| 🦈 **Pitch Perfect** | 3–12 | **Classic** — four product pitches; **Quick** — three faster rounds; final-round votes count double |
| 📝 **Mad Libs Chaos** | 3–9 | **Classic** — three stories, blind blanks, then rate everyone else's words |
| 🤥 **Two Truths, One Lie** | 3–12 | **Classic** — sixty seconds to write, twenty to vote; **Rapid** — fifteen-second votes |
| ✅ **Fact or Fiction** | 3–12 | **Classic** — ten statements with speed and streak bonuses; **Sudden Death** — a wrong answer eliminates you |

## Auth and Lobby Model

```
User     permanent   Supabase auth uid; account or anonymous guest
Group    permanent   owner/member roles, history
Lobby    ephemeral   room code, host, nullable group, players
Session  one run     game id, mode, results, belongs to a lobby
```

- Every player has a Supabase auth uid. Guests use `signInAnonymously` and are identified by `is_anonymous`; there is no custom guest token or separate guest player id.
- `profiles.id` is the auth uid. `groups.owner_id`, `group_members.user_id`, `lobbies.host_id`, `lobby_players.user_id`, `game_sessions.lobby_id` and realtime player ids all use the same uid.
- Guests may join an open lobby but cannot create groups, quick-play lobbies, or group lobbies. Joining by code creates a `lobby_players` row only; it never adds a `group_members` row.
- Any member may open or reopen a group lobby. Opening returns the existing open lobby if one exists. Quick play creates a lobby with `group_id NULL`.
- The creator is the lobby host. Only the host starts or kicks. A host who leaves or disconnects past 30 seconds transfers host to the longest-connected remaining player. An empty lobby closes and its code becomes reusable.
- A game session is created by `POST /api/lobbies/:id/start`; the realtime room then seats `lobby_players` and the host starts the engine automatically once everyone is connected.
- Supabase Auth owns guest policy in the dashboard. The app server enforces `ALLOW_GUESTS=false` by rejecting anonymous tokens on both HTTP and realtime SSE.

### Join flow

```
/join/CODE ─┬─ guest  -> Supabase anonymous session -> POST /lobbies/join -> /lobby/CODE -> /game/SESSION
            └─ account -> sign in/up -----------------> POST /lobbies/join -> /lobby/CODE -> /game/SESSION

/guest + code -> anonymous session -> POST /lobbies/join -> /lobby/CODE

/dashboard -> group -> POST /groups/:id/lobby (open-or-get) -> /lobby/CODE
/dashboard -> Quick play -> POST /lobbies -> /lobby/CODE
```

Guests can upgrade after a game with an email and password. Supabase `updateUser` keeps the same auth uid, so their lobby and session history stay attached.

## Start a Game

1. Sign in, then create a group from the dashboard or landing page. Opening its lobby creates a room code.
2. Press **Open Lobby** or **Play** on any group; any member can open or reopen the room.
3. Share the room code or invite link. Signed-in players can enter the code in **Join with a room code**; guests use `/guest` or the invite page.
4. Pick a game and mode. Each card shows the connected-player requirement.
5. Only the host can start. The lobby marks the room `in_game` and creates the session; connected clients move to the game screen.

**Guest entry:** a guest needs a display name and the room's 6-character code. Guests can join an open lobby but cannot create groups/lobbies or see group history. Set `ALLOW_GUESTS=false` to reject guest auth server-side.

## Setup

### 1. Database

- Create a Supabase project at [supabase.com](https://supabase.com)
- Run `supabase/schema.sql` in the SQL Editor
- Upgrading an existing project, run in order:
  1. `supabase/migrations/supabase-migration-phase3-games.sql`
  2. `supabase/migrations/supabase-migration-phase4-games.sql`
  3. `supabase/migrations/supabase-migration-tier1-games.sql`
  4. `supabase/migrations/supabase-migration-supabase-auth.sql`
  5. `supabase/migrations/supabase-migration-auth-rls.sql`
  6. `supabase/migrations/supabase-migration-auth-lobbies.sql`
- Enable the **Email** provider under Supabase → Authentication → Providers.
- Enable **Anonymous sign-ins** under Authentication → Providers when `ALLOW_GUESTS=true`. Disable it when `ALLOW_GUESTS=false`; app middleware rejects anonymous tokens either way, but the dashboard switch is the provider-level control.
- All app tables are server-only (RLS on, no anon policies). The browser anon key is used for Supabase Auth only; the Next route handlers use the service-role key.

### 2. Environment

```bash
cp .env.example .env.local
# Fill in your Supabase URL, anon key and service-role key
```

### 3. Run the app

```bash
npm install
npm run dev
```

This starts Next.js on http://localhost:3000. Realtime uses SSE plus POST
actions inside the same Next.js process. The app requires a persistent Node
process; it cannot run as a serverless function.

Production:

```bash
npm run build
npm start
```

See `docs/DEPLOYMENT.md` for the systemd unit, nginx SSE proxy, health
checks, and rollback runbook.

### 4. Tests

```bash
npm run test:server
npm run check:api
npm run test:api
```

`test:server` covers the engine, games, auth policy, and schema. `check:api`
checks a running server. `test:api` starts an isolated server, creates temporary
Supabase users, exercises the REST contract and auth rules, and runs a real
multi-client game over SSE. CI runs lint, `test:server`, and the production
build; `test:api` needs live Supabase credentials and is intended for local or
staging runs.

### 5. Seed Demo Data (Optional)

```bash
npm run seed
# Join code: CHASX2
```

## Design

Neon gaming UI with futuristic dark-mode and glassmorphism:

- Cosmic gradient backgrounds
- Glass-morphic cards with neon glows
- Framer Motion animations throughout
- Custom countdown ring, confetti, avatar bubbles
- Mobile-first responsive design

## Adding New Games

1. Add a module in `src/server/games/` that implements the engine contract: `id`, `name`, `minPlayers`, `maxPlayers`, `modes`, `init`, `onEvent`, `onPhaseEnd`, `onPlayerLeave`, `viewFor` and `publicFor`.
2. Register it in `src/server/games/index.js` and add its id to the `game_sessions.game_type` CHECK in a migration. The lobby catalogue is generated from the registry.
3. Add a screen in `src/components/game/` and route it by `room.gameId` in `src/app/game/[sessionId]/page.tsx`.
4. Put its prompt bank in `src/server/data/prompts/` and test both the mechanics and the bank size/id uniqueness.
