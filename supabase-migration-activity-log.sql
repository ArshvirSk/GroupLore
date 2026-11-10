-- ══════════════════════════════════════════════════════════
-- Migration: Activity Log + Player Stats
-- ══════════════════════════════════════════════════════════

-- Activity feed table — tracks events across all groups
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'game_started',
    'game_finished',
    'member_joined',
    'member_left',
    'vote_result',
    'impostor_caught',
    'impostor_survived',
    'streak_achieved',
    'high_score',
    'bluff_success',
    'bluff_caught',
    'most_likely_winner'
  )),
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player stats table — aggregated per-user stats
CREATE TABLE IF NOT EXISTS player_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  times_impostor INTEGER DEFAULT 0,
  times_caught_as_impostor INTEGER DEFAULT 0,
  times_survived_as_impostor INTEGER DEFAULT 0,
  bluffs_attempted INTEGER DEFAULT 0,
  bluffs_successful INTEGER DEFAULT 0,
  total_votes_cast INTEGER DEFAULT 0,
  most_likely_to_wins INTEGER DEFAULT 0,
  fastest_answer_ms INTEGER,
  streak_best INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast feed queries
CREATE INDEX IF NOT EXISTS idx_activity_log_group ON activity_log(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_group_created ON activity_log(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_user ON player_stats(user_id);

-- RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access" ON activity_log FOR ALL USING (true);
CREATE POLICY "Service role access" ON player_stats FOR ALL USING (true);
