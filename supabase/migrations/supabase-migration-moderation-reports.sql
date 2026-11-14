-- Migration: store player reports for moderation review.
-- Run this in the Supabase SQL editor before deploying the reporting flow.
-- Idempotent; safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS moderation_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  reporter_user_id UUID,
  target_user_id UUID,
  reporter_name TEXT NOT NULL,
  target_name TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('harassment', 'hate', 'sexual', 'spam', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_session ON moderation_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_created ON moderation_reports(created_at DESC);

ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON moderation_reports FROM anon, authenticated;

COMMIT;
