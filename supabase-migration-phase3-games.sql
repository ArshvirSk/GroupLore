-- Migration: allow the Phase 3 game types in game_sessions.
-- Run this in the Supabase SQL editor before starting these games in a
-- hosted environment. Existing sessions keep their current type.

ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;

ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_game_type_check
  CHECK (game_type IN (
    'overrated-underrated',
    'guess-impostor',
    'five-second',
    'best-friend-test',
    'most-likely-to',
    'liars-bar',
    'higher-or-lower',
    'avoid-the-answer',
    'hive-mind',
    'odd-one-out',
    'bluff',
    'hot-takes'
  ));
