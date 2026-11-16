-- Selection memory for content banks. Server-only: no client policies.
-- scope_id is the group id when a session belongs to a group, otherwise the
-- lobby/session id. Rows older than 180 days may be pruned by the server.

CREATE TABLE IF NOT EXISTS seen_items (
  scope_id UUID NOT NULL,
  game_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_id, game_id, item_id)
);

CREATE INDEX IF NOT EXISTS seen_items_scope_game_seen_idx
  ON seen_items (scope_id, game_id, seen_at);

ALTER TABLE seen_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON seen_items FROM anon, authenticated;
