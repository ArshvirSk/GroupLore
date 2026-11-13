import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const tables = [
  "profiles",
  "groups",
  "group_members",
  "lobbies",
  "lobby_players",
  "game_sessions",
  "activity_log",
  "player_stats",
];

test("migration enables RLS and revokes browser roles for every app table", async () => {
  const sql = (
    await Promise.all(
      ["auth-rls", "auth-lobbies"].map((name) =>
        readFile(
          new URL(`../../../supabase/migrations/supabase-migration-${name}.sql`, import.meta.url),
          "utf8",
        ),
      ),
    )
  ).join("\n");
  for (const table of tables) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`, "i"),
      `${table} must enable RLS`,
    );
  }
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated/i);
  assert.doesNotMatch(sql, /CREATE POLICY[\s\S]*TO anon/i);
});

const url = process.env.SUPABASE_URL;
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
test(
  "anon key cannot read any app table",
  { skip: !url || !anonKey ? "SUPABASE_URL/SUPABASE_ANON_KEY not set" : false },
  async () => {
    for (const table of tables) {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      assert.ok(
        [401, 403].includes(res.status),
        `${table} exposed to anon (HTTP ${res.status})`,
      );
    }
  },
);
