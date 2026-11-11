import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { supabase } from "../lib/supabase.js";
import { joinLobbyByCode } from "../lib/lobby.js";
import { requireGroupMember } from "../lib/membership.js";

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("guest policy blocks group and lobby creation", async () => {
  const { requireNonGuest } = await import("../lib/auth.js");
  const res = response();
  let called = false;
  await requireNonGuest(
    { user: { id: "guest-1", isGuest: true } },
    res,
    () => {
      called = true;
    },
  );
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, "guest_forbidden");
});

test("a non-member cannot open a group lobby", async () => {
  const original = supabase.from;
  supabase.from = () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: null }),
    };
    return chain;
  };
  try {
    const res = response();
    let called = false;
    await requireGroupMember("id")(
      { params: { id: "group-1" }, body: {}, query: {}, user: { id: "user-1" } },
      res,
      () => {
        called = true;
      },
    );
    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error.code, "not_group_member");
  } finally {
    supabase.from = original;
  }
});

test("a guest joins only lobby_players, never group_members", async () => {
  const original = supabase.from;
  let upsertTable = null;
  const lobby = {
    id: "lobby-1",
    code: "ABC234",
    group_id: "group-1",
    host_id: "host-1",
    status: "open",
    lobby_players: [],
  };

  supabase.from = (table) => {
    const filters = {};
    const chain = {
      select: () => chain,
      eq: (key, value) => {
        filters[key] = value;
        return chain;
      },
      maybeSingle: async () => ({
        data: table === "lobbies" && filters.id ? lobby : { id: "lobby-1", status: "open" },
      }),
      upsert: async () => {
        upsertTable = table;
        return { error: null };
      },
    };
    return chain;
  };

  try {
    const result = await joinLobbyByCode({
      code: "ABC234",
      user: { id: "guest-1", displayName: "Guest", isGuest: true },
    });
    assert.equal(upsertTable, "lobby_players");
    assert.equal(result.id, "lobby-1");
  } finally {
    supabase.from = original;
  }
});

test("schema enforces one open group lobby and frees closed codes", async () => {
  const sql = await readFile(
    new URL("../../supabase-migration-auth-lobbies.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS lobbies_open_code_uidx[\s\S]*WHERE status = 'open'/i,
  );
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS lobbies_one_open_per_group_uidx[\s\S]*WHERE status = 'open' AND group_id IS NOT NULL/i,
  );
});
