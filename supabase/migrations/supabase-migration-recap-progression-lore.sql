-- Migration: recaps, progression, rivalry and opt-in group lore packs.
-- Idempotent; safe to run after the auth/lobby migrations.

BEGIN;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS lore_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS session_recaps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  mode TEXT,
  winner_name TEXT,
  winner_names TEXT[] DEFAULT '{}',
  highlights JSONB DEFAULT '[]',
  scores JSONB DEFAULT '[]',
  share_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_recaps_group
  ON session_recaps(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_recaps_session
  ON session_recaps(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS player_game_ratings (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  game_type TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id, game_type)
);

CREATE TABLE IF NOT EXISTS player_rivalries (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  a_wins INTEGER NOT NULL DEFAULT 0,
  b_wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_a, user_b)
);

CREATE TABLE IF NOT EXISTS group_achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_group_achievements_group
  ON group_achievements(group_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS lore_packs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  prompts JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lore_packs_group
  ON lore_packs(group_id, created_at DESC);

ALTER TABLE session_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_rivalries ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lore_packs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON session_recaps, player_game_ratings, player_rivalries,
  group_achievements, lore_packs FROM anon, authenticated;

COMMIT;
