# Roadmap verification — priorities 3, 5, 8, 1, 7 and 6

Verified on 2026-11-14 against the local working tree. This is evidence for the
six requested roadmap mains, not a claim that every hosted-environment path has
been exercised.

## #3 Crash-safe live-session persistence and recovery

- Status: **complete**.
- Authoritative room snapshots are written at phase boundaries, results and
  moderation changes.
- Boot restores one active, snapshotted room; restored rooms stay paused until a
  player reconnects, then resume their stored phase clock.
- Restore timeout cleanup closes rooms nobody rejoins and prevents a later join
  from resurrecting them.
- Evidence: `src/server/test/engine.test.js` covers phase restore, paused until
  reconnect, timer resume, restore timeout, cleanup failure and rejoin guards.
- Evidence: `src/server/test/persistence.test.js` covers ordered snapshot,
  cleanup and retrying writes.

## #5 Phone-as-controller PWA with QR join

- Status: **complete**.
- `public/manifest.webmanifest`, `public/icon.svg` and `public/sw.js` make the
  app installable; API and realtime responses are deliberately not cached.
- The lobby and TV screen render a QR code for the existing `/join/:code`
  deep link.
- Live game rounds request a screen wake lock and mobile actions use short
  haptics.
- Existing responsive layouts and lobby room-code entry remain the fallback.
- Evidence: production build includes `/recap/[shareId]` and all lobby/game
  routes; `qrcode` is the only new runtime dependency.

## #8 Group progression and rivalry system

- Status: **complete**.
- Per-group, per-game Elo ratings, pairwise head-to-head records and milestone
  achievements are written after finished group games.
- The group page exposes rating leaders, the rivalry board and the hall of fame.
- Missing progression storage is best-effort and never blocks a game result.
- Evidence: `src/server/lib/progression.js` has the pure Elo and achievement
  rules; `src/server/test/roadmap.test.js` checks Elo movement, rivalry ordering
  and milestone thresholds.

## #1 Personalized group-lore engine

- Status: **complete** behind explicit consent and the `LORE_MODE` feature flag.
- Packs are generated locally from `member_profiles` and recent finished-game
  activity. No raw profile text is sent to a model.
- Generation requires group-owner opt-in; a generated pack remains a draft
  until a separate owner approval action archives the prior pack and makes the
  new one live.
- Approved packs are cached in `lore_packs`. Most Likely To uses an approved
  pack only when lore mode is on and falls back to its static bank otherwise.
- The group page includes the lore studio and approval UI.
- Evidence: `src/server/lib/lore.js` and `src/server/test/roadmap.test.js`.

## #7 Safety and moderation controls

- Status: **complete for the planned controls**.
- Host mute, kick, block and report are implemented; block removes the player
  and prevents that identity from rejoining the room.
- Reports are persisted before the reporter sees a successful state; a failed
  insert returns `report_failed` and leaves `yourReports` unchanged.
- Prompt banks have family/teen/mature ratings, NSFW is hidden unless explicitly
  enabled, and `MAX_CONTENT_RATING` supplies an age-appropriate deployment
  ceiling.
- User-authored game-event text is rejected when it contains blocked profanity.
- Evidence: `src/server/test/engine.test.js`, `src/server/test/persistence.test.js`,
  `src/server/test/content.test.js`, and `src/server/test/roadmap.test.js`.

## #6 Shareable recaps and group-lore timeline

- Status: **complete**.
- Every finished game builds a recap with winner, scores and selected public
  moments; persistence stores it independently per finished game.
- Each recap has its own public share id and a public `/recap/[shareId]` page
  with native share/copy support.
- The group page shows a timeline of recent recaps.
- Evidence: `src/server/lib/recap.js`, `src/server/test/roadmap.test.js`,
  `src/server/test/persistence.test.js`, and the production route manifest.

## Checks run

- `npx tsc --noEmit` — pass.
- `npm run test:server` — **115/115 passing**, including multiple recaps in one
  session and a block surviving a snapshot restore.
- `npm run lint` — 0 errors; one pre-existing `fiveSecond.js` warning.
- `npm run build` — pass, including `/recap/[shareId]`, lore, progression and
  recap APIs.

## Deployment prerequisite

Run these migrations in the Supabase SQL editor, in order, before using the new
database-backed features. They are transactional and safe to re-run:

1. `supabase/migrations/supabase-migration-moderation-reports.sql`
2. `supabase/migrations/supabase-migration-recap-progression-lore.sql`

Until then, recaps, progression and lore reads/writes fail closed: game results
still complete, but those sections show their API error instead of pretending
the data was stored.
