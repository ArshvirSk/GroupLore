import assert from "node:assert/strict";
import { test } from "node:test";
import { addNudge, drainNudges } from "../api/nudgeStore.js";
import { allow, resetRateLimits } from "../api/rateLimitStore.js";

test("join limiter caps a key and resets after its window", () => {
  resetRateLimits();
  const now = 1_000_000;

  assert.equal(allow("user:one", 2, 60_000, now), true);
  assert.equal(allow("user:one", 2, 60_000, now + 10), true);
  assert.equal(allow("user:one", 2, 60_000, now + 20), false);
  assert.equal(allow("user:two", 2, 60_000, now + 20), true);

  assert.equal(allow("user:one", 2, 60_000, now + 60_001), true);
  resetRateLimits();
});

test("nudge queue keeps the newest ten and drains on read", () => {
  const groupId = `state-test-${Date.now()}`;
  for (let index = 0; index < 12; index += 1) {
    const result = addNudge(groupId, `player-${index}`);
    assert.equal(result.sent, true);
    assert.equal(typeof result.message, "string");
  }

  const drained = drainNudges(groupId);
  assert.equal(drained.length, 10);
  assert.equal(drained[0].from, "player-2");
  assert.equal(drained[9].from, "player-11");
  assert.deepEqual(drainNudges(groupId), []);
});
