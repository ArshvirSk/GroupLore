# GroupLore Client

Next.js App Router client plus the GroupLore REST API, game engine, and
realtime layer. Everything runs in one Next.js process: pages and API route
handlers, with Server-Sent Events for server-to-client updates and POST for
client actions. There is no custom Node entrypoint.

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

`npm start` is `next start`. The app needs a persistent Node process for SSE
connections and in-memory room timers; it cannot run as serverless functions.
Run one application instance. See `../docs/DEPLOYMENT.md` for the production
process, SSE reverse-proxy settings, and rollback steps.

## Layout

```text
src/app/api/**/route.ts    # REST routes + realtime SSE/action routes
src/server/engine/         # Server-authoritative room and game engine
src/server/realtime/       # Process-wide engine singleton + SSE connection
src/server/games/          # Game modules and registry
src/server/lib/            # Supabase, auth, membership, lobby, activity
src/server/data/           # Prompt banks
src/server/test/           # Engine, game, auth, policy, and RLS tests
test/                      # Live API contract/auth + multi-client game test
```

## Realtime

- `GET /api/realtime/stream` authenticates the Supabase bearer token and opens
  an SSE stream. The first event is `realtime:ready` with a connection ID.
- `POST /api/realtime/action` forwards `room:join`, `room:spectate`,
  `room:leave`, `room:action`, `game:event`, and `room:sync-request` to the
  engine. The connection must belong to the authenticated user.
- The engine keeps the existing event names and view payloads, so the game
  modules and UI do not change.
- Room state and timers are process-local. This is a single-instance design.

## Tests

```bash
npm run test:server
npm run check:api
npm run test:api
```

- `test:server` runs the engine/game/auth/schema suite. It loads
  `.env.local`; the live RLS probe runs when Supabase credentials are present.
- `check:api` checks a running server at `http://localhost:3000`.
- `test:api` starts `next start` on port 3199, creates temporary Supabase users,
  exercises the REST contract and auth rules, plays a real 3-player game over
  SSE, verifies the TV spectator, and cleans up its data. Run `npm run build`
  first. It needs the server-only Supabase credentials.
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
