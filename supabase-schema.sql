-- GroupLore Supabase Schema
-- Run these SQL commands in the Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Clerk)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  clerk_id TEXT UNIQUE,
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
  game_type TEXT NOT NULL CHECK (game_type IN ('overrated-underrated', 'guess-impostor', 'five-second', 'best-friend-test', 'most-likely-to', 'liars-bar', 'higher-or-lower', 'avoid-the-answer', 'hive-mind', 'odd-one-out', 'bluff', 'hot-takes')),
  status TEXT DEFAULT 'lobby' CHECK (status IN ('lobby', 'active', 'finished')),
  current_round INTEGER DEFAULT 0,
  round_data JSONB DEFAULT '{}',
  scores JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_groups_join_code ON groups(join_code);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_member_profiles_group ON member_profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_group ON game_sessions(group_id);

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

-- RLS Policies (basic - allow all for service role)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by backend)
CREATE POLICY "Service role access" ON users FOR ALL USING (true);
CREATE POLICY "Service role access" ON groups FOR ALL USING (true);
CREATE POLICY "Service role access" ON group_members FOR ALL USING (true);
CREATE POLICY "Service role access" ON member_profiles FOR ALL USING (true);
CREATE POLICY "Service role access" ON game_sessions FOR ALL USING (true);
