import assert from "node:assert/strict";
import { test } from "node:test";
import skullDuel from "../games/skullDuel.js";

function makeRoom(count = 3) {
  const players = new Map();
  for (let index = 1; index <= count; index += 1) {
    players.set(`p${index}`, {
      id: `p${index}`,
      name: `Player ${index}`,
      connected: true,
      joinedAt: index,
    });
  }
  return {
    id: `skull-${count}`,
    mode: "classic",
    players,
    scores: Object.fromEntries([...players.keys()].map((id) => [id, 0])),
    state: null,
  };
}

test("each duelist gets three safe tokens and one hazard", () => {
  const room = makeRoom();
  const state = skullDuel.init(room, "classic");
  assert.equal(state.phase, "place");
  for (const tokens of Object.values(state.tokens)) {
    assert.equal(tokens.filter((token) => token.kind === "safe").length, 3);
    assert.equal(tokens.filter((token) => token.kind === "hazard").length, 1);
  }
  const view = skullDuel.viewFor(room, "p1");
  assert.equal(view.tokens.length, 4);
  const publicView = JSON.stringify(skullDuel.publicFor(room));
  assert.equal(publicView.includes("hazard"), false);
});

test("placing and bidding reveals a hazard and costs tokens", () => {
  const room = makeRoom();
  const state = skullDuel.init(room, "classic");
  for (const [playerId, tokens] of Object.entries(state.tokens)) {
    skullDuel.onEvent(room, playerId, { type: "place", tokenId: tokens[3].id });
  }
  assert.equal(state.phase, "bid");
  skullDuel.onEvent(room, "p1", { type: "bid", value: 1 });
  skullDuel.onEvent(room, "p2", { type: "bid", value: 1 });
  skullDuel.onEvent(room, "p3", { type: "bid", value: 1 });
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.hitHazard, true);
  assert.equal(state.reveal.bidderId, "p1");
  assert.equal(state.lost.p1.length, 2);
});

test("a safe challenge wins and quick mode ends at one", () => {
  const room = makeRoom();
  room.mode = "quick";
  const state = skullDuel.init(room, "quick");
  const safe = state.tokens.p1.find((token) => token.kind === "safe");
  state.placed = {
    p1: safe.id,
    p2: state.tokens.p2[0].id,
    p3: state.tokens.p3[0].id,
  };
  state.phase = "bid";
  skullDuel.onEvent(room, "p1", { type: "bid", value: 1 });
  assert.equal(state.phase, "bid");
  skullDuel.onEvent(room, "p2", { type: "bid", value: 1 });
  skullDuel.onEvent(room, "p3", { type: "bid", value: 1 });
  assert.equal(state.reveal.success, true);
  assert.equal(state.wins.p1, 1);
  skullDuel.onPhaseEnd(room);
  assert.equal(state.done, true);
  assert.equal(room.scores.p1 >= 1500, true);
});

test("timeouts place and bid so a stalled table keeps moving", () => {
  const room = makeRoom();
  const state = skullDuel.init(room, "classic");
  skullDuel.onPhaseEnd(room);
  assert.equal(state.phase, "bid");
  assert.equal(Object.keys(state.placed).length, 3);
  skullDuel.onPhaseEnd(room);
  assert.equal(state.phase, "reveal");
  assert.ok(state.reveal);
});

test("leaving with fewer than three duelists ends the duel", () => {
  const room = makeRoom(3);
  const state = skullDuel.init(room, "classic");
  room.players.delete("p3");
  skullDuel.onPlayerLeave(room, "p3");
  assert.equal(state.done, true);
  assert.equal(skullDuel.onPhaseEnd(room), "results");
});
