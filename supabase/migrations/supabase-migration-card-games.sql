-- Migration: allow the card-game session types.
-- Run in the Supabase SQL editor before starting Cheat, Skull Duel or
-- Blackjack Showdown in a hosted environment. Existing rows are unchanged.

ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_game_type_check;

ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_game_type_check
  CHECK (game_type IN (
    'overrated-underrated', 'guess-impostor', 'five-second', 'best-friend-test',
    'most-likely-to', 'liars-bar', 'cheat', 'skull-duel', 'blackjack-showdown',
    'higher-or-lower', 'avoid-the-answer', 'hive-mind', 'odd-one-out', 'bluff',
    'hot-takes', 'would-you-rather', 'caption-this', 'wavelength',
    'category-rush', 'roast-battle', 'acronym-wars', 'pitch-perfect',
    'mad-libs', 'two-truths', 'fact-or-fiction', 'fill-the-blank',
    'connections', 'survey-says', 'scattergories', 'pattern-memory',
    'reaction-duel', 'story-chain', 'password', 'boggle-rush',
    'buzzer-trivia', 'liars-dice', 'blur-guess', 'codenames', 'blind-sketch',
    'duel-bracket'
  ));
