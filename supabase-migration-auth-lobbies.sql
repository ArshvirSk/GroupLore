-- Migration: separate identity, groups, lobbies and game sessions.
--
-- Order:
--   1. supabase-migration-supabase-auth.sql
--   2. supabase-migration-auth-rls.sql
--   3. this file
--
-- This migration is idempotent. It assumes the service role is the only
-- database client and that Supabase Anonymous sign-ins are configured in the
-- dashboard when ALLOW_GUESTS=true.
--
-- Rollback notes (run only after taking the app offline):
--   * game_sessions.group_id cannot be restored for rooms created after this
--     migration because a lobby may have group_id NULL.
--   * groups.created_by and groups.join_code cannot be restored for groups
--     created after this migration. Restore from a backup if needed.
--   * The new tables (lobbies, lobby_players, profiles) can be dropped after
--     restoring the old columns and code.
--   * activity_log/player_stats user ids were remapped to auth uids. Keep the
--     legacy users table until member_profiles is migrated separately.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (auth uid is the identity)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO profiles (id, display_name, avatar_url, is_guest, created_at)
SELECT
  u.auth_user_id::uuid,
  COALESCE(NULLIF(u.name, ''), 'Player'),
  u.avatar_url,
  FALSE,
  COALESCE(u.created_at, NOW())
FROM users u
WHERE u.auth_user_id IS NOT NULL
  AND u.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON profiles FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Groups: owner_id replaces created_by; join_code is replaced by lobby codes
-- ---------------------------------------------------------------------------

ALTER TABLE groups ADD COLUMN IF NOT EXISTS owner_id UUID;

UPDATE groups g
SET owner_id = u.auth_user_id::uuid
FROM users u
WHERE g.created_by = u.id
  AND g.owner_id IS NULL
  AND u.auth_user_id IS NOT NULL
  AND u.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- If a group's creator no longer exists, promote its first member.
UPDATE groups g
SET owner_id = gm.user_id
FROM (
  SELECT DISTINCT ON (group_id) group_id, user_id
  FROM group_members
  ORDER BY group_id, joined_at ASC, user_id ASC
) gm
WHERE gm.group_id = g.id
  AND g.owner_id IS NULL;

ALTER TABLE groups DROP COLUMN IF EXISTS join_code;
DROP INDEX IF EXISTS idx_groups_join_code;
ALTER TABLE groups DROP COLUMN IF EXISTS created_by;

ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS groups_owner_id_fkey;
ALTER TABLE groups
  ADD CONSTRAINT groups_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);

-- ---------------------------------------------------------------------------
-- Group membership roles and auth-uid user ids
-- ---------------------------------------------------------------------------

ALTER TABLE group_members
  DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;
ALTER TABLE group_members
  DROP CONSTRAINT IF EXISTS group_members_group_id_user_id_key;

UPDATE group_members gm
SET user_id = u.auth_user_id::uuid
FROM users u
WHERE gm.user_id = u.id
  AND u.auth_user_id IS NOT NULL
  AND u.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE group_members SET role = 'owner' WHERE role = 'host' OR role IS NULL;

-- Drop memberships whose legacy user never linked a Supabase auth id.
DELETE FROM group_members gm
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = gm.user_id);

-- Keep the earliest row if the legacy mapping produced duplicates.
DELETE FROM group_members gm
USING group_members keep
WHERE gm.group_id = keep.group_id
  AND gm.user_id = keep.user_id
  AND (gm.joined_at, gm.id) > (keep.joined_at, keep.id);

ALTER TABLE group_members
  DROP CONSTRAINT IF EXISTS group_members_role_check;
ALTER TABLE group_members
  ADD CONSTRAINT group_members_role_check
  CHECK (role IN ('owner', 'member'));

ALTER TABLE group_members
  ADD CONSTRAINT group_members_group_id_user_id_key
  UNIQUE (group_id, user_id);

ALTER TABLE group_members
  ADD CONSTRAINT group_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Lobbies and lobby players
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  host_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_game', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Codes are unique only while a lobby is open, so a closed room's code is free.
CREATE UNIQUE INDEX IF NOT EXISTS lobbies_open_code_uidx
  ON lobbies(code) WHERE status = 'open';
CREATE UNIQUE INDEX IF NOT EXISTS lobbies_one_open_per_group_uidx
  ON lobbies(group_id) WHERE status = 'open' AND group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lobbies_group ON lobbies(group_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_host ON lobbies(host_id);

CREATE TABLE IF NOT EXISTS lobby_players (
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  connected BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lobby_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lobby_players_user ON lobby_players(user_id);
CREATE INDEX IF NOT EXISTS idx_lobby_players_lobby ON lobby_players(lobby_id);

ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lobbies FROM anon, authenticated;
REVOKE ALL ON lobby_players FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sessions belong to a lobby; backfill one lobby per legacy session
-- ---------------------------------------------------------------------------

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS lobby_id UUID;

INSERT INTO lobbies (id, code, group_id, host_id, status, created_at, closed_at)
SELECT
  gs.id,
  translate(upper(substr(md5(gs.id::text), 1, 6)), '01OI', 'ABCD'),
  gs.group_id,
  g.owner_id,
  CASE
    WHEN gs.status = 'lobby' THEN 'open'
    WHEN gs.status = 'active' THEN 'in_game'
    ELSE 'closed'
  END,
  COALESCE(gs.created_at, NOW()),
  CASE WHEN gs.status = 'finished' THEN NOW() ELSE NULL END
FROM game_sessions gs
LEFT JOIN groups g ON g.id = gs.group_id
WHERE gs.lobby_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE game_sessions SET lobby_id = id WHERE lobby_id IS NULL;

ALTER TABLE game_sessions
  ALTER COLUMN lobby_id SET NOT NULL;

ALTER TABLE game_sessions
  DROP CONSTRAINT IF EXISTS game_sessions_lobby_id_fkey;
ALTER TABLE game_sessions
  ADD CONSTRAINT game_sessions_lobby_id_fkey
  FOREIGN KEY (lobby_id) REFERENCES lobbies(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_game_sessions_group;
ALTER TABLE game_sessions DROP COLUMN IF EXISTS group_id;
CREATE INDEX IF NOT EXISTS idx_game_sessions_lobby ON game_sessions(lobby_id);

-- ---------------------------------------------------------------------------
-- Activity/stats now use auth uids. member_profiles is intentionally untouched.
-- ---------------------------------------------------------------------------

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE player_stats
  DROP CONSTRAINT IF EXISTS player_stats_user_id_fkey;

UPDATE activity_log a
SET user_id = u.auth_user_id::uuid
FROM users u
WHERE a.user_id = u.id
  AND u.auth_user_id IS NOT NULL
  AND u.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE player_stats p
SET user_id = u.auth_user_id::uuid
FROM users u
WHERE p.user_id = u.id
  AND u.auth_user_id IS NOT NULL
  AND u.auth_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Rows whose legacy user never linked an auth uid cannot satisfy the new
-- profile foreign key; clear/remove them before adding the constraints.
UPDATE activity_log a
SET user_id = NULL
WHERE a.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = a.user_id);

DELETE FROM player_stats p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles profile WHERE profile.id = p.user_id);

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE player_stats
  DROP CONSTRAINT IF EXISTS player_stats_user_id_fkey;
ALTER TABLE player_stats
  ADD CONSTRAINT player_stats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- New app tables are server-only, matching the existing RLS posture.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
