# GroupLore 🎲

> **Real-time multiplayer party games, personalized for your friend group.**

Inside jokes, embarrassing habits, iconic moments — turned into multiplayer chaos.

---

## Architecture

```
GroupLore/
├── client/                 # Next.js 15 (App Router)
│   ├── src/app/           # Pages (landing, dashboard, group, lobby, game)
│   ├── src/components/    # 9 reusable UI components
│   ├── src/stores/        # Zustand state management
│   └── src/lib/           # Socket.io client, API client
├── server/                # Express + Socket.io
│   ├── routes/            # REST API (groups, members, games)
│   ├── sockets/           # Real-time event handlers
│   │   └── games/         # Game-specific logic (modular)
│   └── lib/               # Supabase client
└── supabase-schema.sql    # Database schema
```

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | Next.js 15, Tailwind CSS v4, Framer Motion, Zustand |
| Backend   | Express, Socket.io                                  |
| Database  | Supabase (PostgreSQL)                               |
| Auth      | Supabase Auth (email + password)                    |
| Real-time | Socket.io (WebSockets)                              |

## Games

All games below are playable through the server-authoritative engine. Every game reads only its own prompt bank, not `member_profiles`.

Most games support **3–12 players**. **Odd One Out** requires **4–12**. Modes are selected in the lobby.

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

## Start a Game

1. Sign in, then create a group from the dashboard or landing page. Its first lobby opens immediately.
2. To reopen a room, press **Open Lobby** or **Play** on an existing group. Any group member can open the lobby.
3. Share the room code and invite link shown in the lobby header. The code opens `/join/CODE` and is the same code guests enter at `/guest`. Signed-in players can also type the code into **Join with a room code** on the dashboard.
4. Pick a game. Each card shows how many more players it needs.
5. Once enough players are connected, anyone in the lobby can press **Start game**.

The normal flow is dashboard → lobby → game. Invitees go from invite link → choose guest or account → lobby or group. The active lobby keeps its group name and room code visible so the context does not disappear when play starts.

**Guest entry:** a guest needs only a display name and the room's 6-character code. Guests can join an **already-open lobby** but cannot create groups or lobbies, and cannot see group history. Use `/guest` directly, or choose **Continue as guest** on the invite, home, or sign-in screens. Set `ALLOW_GUESTS=false` to require an account for every player.

## Setup

### 1. Database

- Create a Supabase project at [supabase.com](https://supabase.com)
- Run `supabase-schema.sql` in the SQL Editor
- Upgrading an existing project: run `supabase-migration-phase3-games.sql` and `supabase-migration-phase4-games.sql` for the Phase 3/4 game ids, `supabase-migration-tier1-games.sql` for the current game expansion, `supabase-migration-supabase-auth.sql` to move users onto Supabase Auth ids, and `supabase-migration-auth-rls.sql` to make app tables server-only
- Enable the **Email** provider under Supabase → Authentication → Providers
- All app tables are server-only. The browser anon key is used for Supabase Auth only; the Express API uses the service-role key.

### 2. Environment

```bash
cp .env.example .env
# Fill in your Supabase URL, anon key and service-role key
```

### 3. Server

```bash
cd server
npm install
npm run dev
```

### 4. Client

```bash
cd client
npm install
npm run dev
```

### 5. Seed Demo Data (Optional)

```bash
cd server
node seed.js
# Join code: CHAOS1
```

## Design

Neon gaming UI with futuristic dark-mode and glassmorphism:

- Cosmic gradient backgrounds
- Glass-morphic cards with neon glows
- Framer Motion animations throughout
- Custom countdown ring, confetti, avatar bubbles
- Mobile-first responsive design

## Adding New Games

1. Add a module in `server/games/` that implements the engine contract: `id`, `name`, `minPlayers`, `maxPlayers`, `modes`, `init`, `onEvent`, `onPhaseEnd`, `onPlayerLeave`, `viewFor` and `publicFor`.
2. Register it in `server/games/index.js` and add its id to the `game_sessions.game_type` CHECK in a migration. The lobby catalogue is generated from the registry.
3. Add a screen in `client/src/components/game/` and route it by `room.gameId` in `client/src/app/game/[sessionId]/page.tsx`.
4. Put its prompt bank in `server/data/prompts/` and test both the mechanics and the bank size/id uniqueness.
