# Deployment

GroupLore runs as one long-lived Next.js process. Next.js serves the pages,
the REST API, and the realtime layer: Server-Sent Events for server-to-client
updates and authenticated POST requests for client actions. There is no custom
Node entrypoint and no Socket.io server.

This design requires a persistent Node process. It cannot run as serverless
functions, and live rooms, timers, nudge queues, and join limits are
process-local. Run exactly one application instance.

## Requirements

- Node.js 22 or newer
- The Supabase project and its SQL migrations
- Environment variables from `.env.example`
- A reverse proxy for TLS, or direct HTTPS termination

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side. Only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser
configuration.

## Build and run

```bash
npm ci
npm run build
NODE_ENV=production PORT=3000 npm start
```

`npm start` runs `next start`. The process must stay alive for SSE connections
and game timers.

Health check:

```bash
curl --fail http://127.0.0.1:3000/api/health
```

The production check suite expects `.env.local`:

```bash
npm run test:server
npm run build
npm run test:api
npm run check:api
```

`test:api` starts its own `next start` server on `127.0.0.1:3199` and uses real
Supabase test accounts, cleaning them up afterward.

## systemd

Copy `deploy/grouplore.service` to `/etc/systemd/system/grouplore.service`.
Put production values in `/etc/grouplore.env` and keep it readable only by the
service user:

```bash
sudo install -m 600 -o root -g root /dev/null /etc/grouplore.env
sudo systemctl daemon-reload
sudo systemctl enable --now grouplore
sudo systemctl status grouplore
```

The unit assumes a release symlink at `/srv/grouplore/current` and a
`grouplore` user. Adjust `WorkingDirectory` if your layout differs.

## Reverse proxy

Use `deploy/nginx.conf` as the nginx template. The SSE route needs:

- `proxy_http_version 1.1`
- `proxy_buffering off`
- `proxy_cache off`
- a read timeout longer than a game session
- `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`

Verify the deployed proxy with a real browser session:

1. Open a lobby in one browser and a second player in another.
2. Confirm both receive live lobby updates.
3. Start a game and confirm actions and sync events continue through the
   proxy, not just the initial HTTP load.
4. Open the TV spectator view and confirm it receives live game state.
5. Check the browser network panel: `/api/realtime/stream` must remain an open
   `text/event-stream` response, not a buffered or repeatedly failing request.

Do not test only `GET /`; the page can load while the SSE route is buffered or
blocked.

## Single-instance and restart behavior

- Live room state is in memory. A restart loses active rooms; clients must
  rejoin from the persisted session/lobby.
- SSE connections are held by the same process that owns the engine.
- Rate limits and nudges are process-local.
- Do not run multiple Node processes behind a load balancer. There is no
  shared room state or cross-process broadcast.

## Guest accounts

Guest sign-in depends on Supabase anonymous sign-ins. If that provider is
disabled, the app reports guests as unavailable and guest-only flows cannot be
tested end to end. Enabling it is a Supabase project setting, not an
application deployment step.

## Database migrations

Apply the root SQL files in the Supabase SQL editor (or your migration
pipeline) before starting a release. The retired `server/migrate-activity.js`
was a one-off helper and is intentionally not part of the runtime; apply
`supabase/migrations/supabase-migration-activity-log.sql` directly if that migration still needs
to be run. Do not grant the application service-role key access to the
Supabase Management API.

## Rollback

Keep the previous release directory and symlink before deploying:

```bash
cd /srv/grouplore
sudo ln -s /srv/grouplore/releases/2026-11-13T120000Z current.new
sudo mv -T current.new current   # atomically replace the symlink
sudo systemctl restart grouplore
sudo systemctl status grouplore
```

Before the switch, tag the deployed commit:

```bash
git tag -a deploy-2026-11-13 -m "Production deploy"
```

Rollback steps:

1. Point `current` back to the previous release.
2. Run `sudo systemctl restart grouplore`.
3. Confirm `/api/health` and a real two-player SSE game flow.
4. Do not roll back database migrations blindly; restore a Supabase backup or
   apply a reviewed down migration if the schema change is incompatible.

Normal rollback is to the previous Next.js release. The retired Express and
Socket.io servers are not part of the running deployment.
