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

1. **Most Likely To** — Vote for the player who fits the prompt
2. **Guess the Impostor** — One player doesn't know the prompt
3. **5 Second Challenge** — Answer before time runs out
4. **Overrated / Underrated** — Vote on group habits and moments
5. **Liars Bar** — The storyteller picks a truth or a lie; the group calls it
6. **Higher / Lower** — Rate the room, then call the next ranking
7. **Avoid the Answer** — Describe the secret word without its banned words
8. **Would You Rather** — Pick a side and see how the group splits
9. **Caption This** — Write the funniest caption, then vote anonymously
10. **Wavelength** — Give a clue that lands on the hidden point of a spectrum
11. **Category Rush** — One category, one letter, one answer
12. **Hive Mind** — Match the group's answers to score
13. **Odd One Out** — One player has a different prompt
14. **Bluff** — Write a fake definition and spot the real one
15. **Hot Takes** — Back the unpopular opinion

## Start a Game

1. Sign in, then create a group from the dashboard or open an existing one.
2. Press **Open Lobby** or **Play**. Any group member can open the lobby.
3. Share the group's invite link (`/join/CODE`) from the group page or lobby.
4. Pick a game. Each card shows how many more players it needs.
5. Once enough players are connected, anyone in the lobby can press **Start game**.

The normal flow is dashboard → lobby → game. Invitees go from invite link → choose guest or account → lobby or group.

**Guest entry:** a guest needs only a display name and the group's 6-character code. Guests can join an **already-open lobby** but cannot create groups or lobbies, and cannot see group history. Use `/guest` directly, or choose **Continue as guest** on the invite, home, or sign-in screens. Set `ALLOW_GUESTS=false` to require an account for every player.

## Setup

### 1. Database

- Create a Supabase project at [supabase.com](https://supabase.com)
- Run `supabase-schema.sql` in the SQL Editor
- Upgrading an existing project: run `supabase-migration-phase3-games.sql` and `supabase-migration-phase4-games.sql` for the Phase 3/4 game ids, `supabase-migration-supabase-auth.sql` to move users onto Supabase Auth ids, and `supabase-migration-auth-rls.sql` to make app tables server-only
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
