-- Lock down direct browser access to app data.
--
-- The browser uses the Supabase anon key only for auth. All app-table reads and
-- writes go through the Express API, which uses the service-role key. The
-- service role bypasses RLS, so no browser-facing policies are needed.

BEGIN;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access" ON users;
DROP POLICY IF EXISTS "Service role access" ON groups;
DROP POLICY IF EXISTS "Service role access" ON group_members;
DROP POLICY IF EXISTS "Service role access" ON member_profiles;
DROP POLICY IF EXISTS "Service role access" ON game_sessions;
DROP POLICY IF EXISTS "Service role access" ON activity_log;
DROP POLICY IF EXISTS "Service role access" ON player_stats;

-- Defense in depth: even a future permissive policy cannot expose these tables
-- to the public browser roles without an explicit grant.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

COMMIT;
