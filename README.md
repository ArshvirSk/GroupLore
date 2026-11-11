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

1. **🔥 Overrated / Underrated** — Vote on group habits and moments
2. **🕵️ Guess the Impostor** — One player doesn't know the prompt
3. **⚡ 5 Second Challenge** — Answer before time runs out

## Setup

### 1. Database

- Create a Supabase project at [supabase.com](https://supabase.com)
- Run `supabase-schema.sql` in the SQL Editor
- Upgrading an existing project: run `supabase-migration-phase3-games.sql` for the Phase 3 game ids, `supabase-migration-supabase-auth.sql` to move users onto Supabase Auth ids, and `supabase-migration-auth-rls.sql` to make app tables server-only
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

1. Create `server/sockets/games/newGame.js` with `nextRound`, `submitVote`/`submitAnswer`
2. Register in `server/sockets/gameHandler.js`
3. Add UI component in `client/src/app/game/[sessionId]/page.tsx`
4. Add game card in `client/src/app/lobby/[sessionId]/page.tsx`
