-- Migration: allow the MODES_2 game types in game_sessions.
-- Run this after the tier1 migration and before opening these games.

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
    'hot-takes',
    'would-you-rather',
    'caption-this',
    'wavelength',
    'category-rush',
    'roast-battle',
    'acronym-wars',
    'pitch-perfect',
    'mad-libs',
    'two-truths',
    'fact-or-fiction',
    'fill-the-blank',
    'connections',
    'survey-says',
    'scattergories',
    'pattern-memory',
    'reaction-duel',
    'story-chain',
    'password',
    'boggle-rush',
    'buzzer-trivia',
    'liars-dice',
    'blur-guess',
    'codenames',
    'blind-sketch',
    'duel-bracket'
  ));
