# Deployment

GroupLore is one long-lived Node process serving the Next.js app, the REST
routes, and Socket.io on the same origin. It cannot run as a serverless
function, and live rooms, nudge queues, and join limits are process-local.
Run exactly one application instance unless those stores and the Socket.io
adapter are replaced with shared infrastructure.

## Requirements

- Node.js 22 or newer
- The Supabase project and its SQL migrations
- Environment variables from `client/.env.example`
- A reverse proxy for TLS, or direct HTTPS termination

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side. Only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser
configuration.

## Build and run

```bash
cd client
npm ci
npm run build
NODE_ENV=production PORT=3000 node server.mjs
```

The process must receive `SIGTERM` for graceful shutdown. `server.mjs` closes
the HTTP server and Socket.io before exiting.

Health check:

```bash
curl --fail http://127.0.0.1:3000/api/health
```

The production check suite expects `client/.env.local`:

```bash
cd client
npm run test:server
npm run test:api
npm run check:api
```

`test:api` starts its own server on `127.0.0.1:3199` and uses real Supabase
test accounts, cleaning them up afterward.

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

## Reverse proxy and WebSocket upgrade

Use `deploy/nginx.conf` as the nginx template. The `/socket.io/` location must
forward:

- `Upgrade: websocket`
- `Connection: upgrade`
- `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`
- a read timeout longer than the engine's idle period

Verify the deployed proxy with a real browser session:

1. Open a lobby in one browser and a second player in another.
2. Confirm both receive live lobby updates.
3. Start a game and confirm socket actions and sync events continue through
   the proxy, not just the initial HTTP load.
4. Open the TV spectator view and confirm it receives live game state.
5. Check the browser network panel: the Socket.io connection must be
   `101 Switching Protocols`, not repeated polling failures.

Do not test only `GET /`; the HTTP page can load while `/socket.io/` is broken.

## Single-instance and restart behavior

- Live room state is in memory. A restart loses active rooms; clients must
  rejoin from the persisted session/lobby.
- Rate limits and nudges are process-local.
- Do not run multiple Node processes behind a load balancer without a shared
  Socket.io adapter and shared room/rate-limit state.

## Guest accounts

Guest sign-in depends on Supabase anonymous sign-ins. If that provider is
disabled, the app reports guests as unavailable and guest-only flows cannot be
tested end to end. Enabling it is a Supabase project setting, not an
application deployment step.

## Database migrations

Apply the root SQL files in the Supabase SQL editor (or your migration
pipeline) before starting a release. The retired `server/migrate-activity.js`
was a one-off helper and is intentionally not part of the runtime; apply
`supabase-migration-activity-log.sql` directly if that migration still needs
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
3. Confirm `/api/health` and a real two-player Socket.io flow.
4. Do not roll back database migrations blindly; restore a Supabase backup or
   apply a reviewed down migration if the schema change is incompatible.

The retired Express server is not part of the running deployment. A full
pre-migration rollback requires restoring commit `de0596f^` in a separate
checkout and reconfiguring its old port and client URL; normal rollback is to
the previous Next.js release.
