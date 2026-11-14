-- GroupLore Supabase Schema
-- Run these SQL commands in the Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (one row per Supabase Auth user)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  auth_user_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_by UUID REFERENCES users(id),
  join_code TEXT UNIQUE NOT NULL,
  lore_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members junction table
CREATE TABLE IF NOT EXISTS group_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('host', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Member Profiles (group context per member)
CREATE TABLE IF NOT EXISTS member_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  display_name TEXT NOT NULL,
  nickname TEXT,
  traits TEXT[] DEFAULT '{}',
  habits TEXT[] DEFAULT '{}',
  iconic_moments TEXT[] DEFAULT '{}',
  catchphrases TEXT[] DEFAULT '{}',
  most_likely_to TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game Sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN ('overrated-underrated', 'guess-impostor', 'five-second', 'best-friend-test', 'most-likely-to', 'liars-bar', 'higher-or-lower', 'avoid-the-answer', 'hive-mind', 'odd-one-out', 'bluff', 'hot-takes', 'would-you-rather', 'caption-this', 'wavelength', 'category-rush', 'roast-battle', 'acronym-wars', 'pitch-perfect', 'mad-libs', 'two-truths', 'fact-or-fiction', 'fill-the-blank', 'connections', 'survey-says', 'scattergories', 'pattern-memory', 'reaction-duel', 'story-chain', 'password', 'boggle-rush', 'buzzer-trivia', 'liars-dice', 'blur-guess', 'codenames', 'blind-sketch', 'duel-bracket')),
  status TEXT DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'finished')),
  current_round INTEGER DEFAULT 0,
  round_data JSONB DEFAULT '{}',
  scores JSONB DEFAULT '{}',
  snapshot JSONB,
  snapshot_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_groups_join_code ON groups(join_code);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_member_profiles_group ON member_profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_group ON game_sessions(group_id);

-- Finished-session recaps. A session can produce one recap per game.
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

CREATE INDEX IF NOT EXISTS idx_session_recaps_group ON session_recaps(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_recaps_session ON session_recaps(session_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_activity_log_group ON activity_log(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_group_created ON activity_log(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_user ON player_stats(user_id);

-- Per-group, per-game ratings and head-to-head records.
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

CREATE INDEX IF NOT EXISTS idx_group_achievements_group ON group_achievements(group_id, earned_at DESC);

-- Opt-in, human-approved group lore packs generated from member profiles.
CREATE TABLE IF NOT EXISTS lore_packs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  prompts JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lore_packs_group ON lore_packs(group_id, created_at DESC);

-- Moderation reports are written only by the server and reviewed out of band.
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

-- RLS: app data is server-only. The service role bypasses RLS; browser roles
-- must not read or write these tables directly with the public anon key.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_rivalries ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE lore_packs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
