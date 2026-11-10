-- Migration: Fix game_type constraint to include all game types
-- Run this in Supabase SQL Editor if your database already exists

-- Drop the old constraint
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;

-- Add the updated constraint with all game types
ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_game_type_check
  CHECK (game_type IN (
    'overrated-underrated',
    'guess-impostor',
    'five-second',
    'best-friend-test',
    'most-likely-to',
    'liars-bar',
    'higher-or-lower',
    'avoid-the-answer'
  ));
