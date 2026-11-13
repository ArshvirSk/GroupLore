# GroupLore Client

Next.js App Router client plus the GroupLore REST API, game engine, and
Socket.io server. Everything runs in one Node process via `server.mjs`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Copy the root `.env.example` to
`client/.env.local` first and fill in the Supabase values.

Production:

```bash
npm run build
npm start
```

`npm start` is not a serverless deployment. The app needs a persistent Node
process for Socket.io. Vercel/serverless functions cannot host it as-is.

## Layout

```text
server.mjs                 # Next request handler + Socket.io on one HTTP server
src/app/api/**/route.ts    # 31 REST route handlers
src/server/engine/         # Server-authoritative room and game engine
src/server/games/          # Game modules and registry
src/server/lib/            # Supabase, auth, membership, lobby, activity
src/server/data/           # Prompt banks
src/server/test/           # Engine, game, auth, policy, and RLS tests
test/                      # Live API contract/auth + multi-client game test
```

## Tests

```bash
npm run test:server
npm run check:api
npm run test:api
```

- `test:server` runs the engine/game/auth/schema suite. It loads
  `.env.local`; the live RLS probe runs when Supabase credentials are present.
- `check:api` checks a running server at `http://localhost:3000`.
- `test:api` starts its own production-mode server on port 3199, creates
  temporary Supabase users, exercises the REST contract and auth rules, plays
  a real 3-player game over Socket.io, verifies the TV spectator, and cleans
  up its data. It needs the server-only Supabase credentials.
- Set `API_BASE` to point `check:api` at another origin.
- Set `TEST_ACCESS_TOKEN` to include authenticated cases in `check:api`.
- CI runs `npm run lint`, `npm run test:server`, and `npm run build` without
  live credentials. The integration suite is not part of CI because it creates
  and removes real Supabase data.

## Seed demo data

```bash
npm run seed
```

The demo account is `demo@grouplore.app` / `grouplore-demo`; the seeded room
code is `CHASX2`.
