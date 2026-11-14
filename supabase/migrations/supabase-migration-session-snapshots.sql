-- Persist the latest phase-boundary snapshot for a live game session so one
-- active room can be restored after a server restart.

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS snapshot JSONB;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS snapshot_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_game_sessions_live_snapshot
  ON game_sessions (snapshot_updated_at DESC)
  WHERE status = 'active' AND snapshot IS NOT NULL;