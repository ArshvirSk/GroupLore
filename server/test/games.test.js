import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import fiveSecond from "../games/fiveSecond.js";
import impostor from "../games/impostor.js";
import overrated from "../games/overrated.js";

const require = createRequire(import.meta.url);

function makeRoom(count, mode) {
  const players = new Map();
  for (let index = 0; index < count; index += 1) {
    const id = `p${index + 1}`;
    players.set(id, {
      id,
      name: `Player ${index + 1}`,
      connected: true,
      joinedAt: index,
    });
  }
  return {
    id: "session-test",
    groupId: "group-test",
    players,
    mode,
    scores: Object.fromEntries([...players.keys()].map((id) => [id, 0])),
    state: null,
  };
}

test("impostor keeps the prompt secret and awards the crew when caught", () => {
  const room = makeRoom(4, "classic");
  const state = impostor.init(room, "classic");
  assert.equal(state.phase, "answer");
  assert.equal(state.impostorIds.length, 1);

  const impostorId = state.impostorIds[0];
  const crewId = [...room.players.keys()].find((id) => id !== impostorId);
  const crewView = impostor.viewFor(room, crewId);
  const impostorView = impostor.viewFor(room, impostorId);

  assert.equal(typeof crewView.prompt, "string");
  assert.ok(crewView.prompt.length > 0);
  assert.equal(impostorView.prompt, null);
  assert.equal(impostorView.isImpostor, true);
  assert.equal(JSON.stringify(crewView).includes(impostorId), false);

  const publicAnswer = impostor.publicFor(room);
  assert.equal(publicAnswer.prompt, undefined);
  assert.equal(JSON.stringify(publicAnswer).includes(impostorId), false);

  for (const playerId of room.players.keys()) {
    impostor.onEvent(room, playerId, {
      type: "answer",
      value: `clue from ${playerId}`,
    });
  }
  assert.equal(state.phase, "discussion");
  assert.equal(state.clues.length, 4);
  assert.equal("playerId" in state.clues[0], false);

  impostor.onPhaseEnd(room);
  assert.equal(state.phase, "vote");

  for (const playerId of room.players.keys()) {
    impostor.onEvent(room, playerId, {
      type: "vote",
      targetPlayerId: playerId === impostorId ? crewId : impostorId,
    });
  }

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.caught, true);
  assert.equal(room.scores[impostorId], 0);
  for (const playerId of room.players.keys()) {
    if (playerId !== impostorId) assert.equal(room.scores[playerId], 1);
  }

  impostor.onPhaseEnd(room);
  assert.equal(state.phase, "answer");
  assert.equal(state.round, 2);
});

test("impostor double agent needs four players and an impostor leaving ends the game", () => {
  const trio = makeRoom(3, "double-agent");
  const trioState = impostor.init(trio, "double-agent");
  assert.equal(trioState.impostorIds.length, 1);

  const squad = makeRoom(4, "double-agent");
  const squadState = impostor.init(squad, "double-agent");
  assert.equal(squadState.impostorIds.length, 2);

  const leavingId = squadState.impostorIds[0];
  assert.equal(impostor.onPlayerLeave(squad, leavingId), "results");
  assert.equal(squad.state.done, true);
});

test("five second accepts only the current player and hides judge votes until reveal", () => {
  const room = makeRoom(3, "classic");
  const state = fiveSecond.init(room, "classic");
  const currentId = state.currentPlayerId;
  const otherIds = [...room.players.keys()].filter((id) => id !== currentId);

  assert.throws(
    () => fiveSecond.onEvent(room, otherIds[0], { type: "answer", value: "nope" }),
    /not your turn/i,
  );

  const currentView = fiveSecond.viewFor(room, currentId);
  assert.equal(currentView.youAreAnswering, true);
  assert.equal(typeof currentView.prompt, "string");

  fiveSecond.onEvent(room, currentId, { type: "answer", value: "a good answer" });
  assert.equal(state.phase, "judge");
  assert.equal(fiveSecond.viewFor(room, otherIds[0]).answer, "a good answer");

  fiveSecond.onEvent(room, otherIds[0], { type: "judge", value: "nailed" });
  assert.equal(fiveSecond.viewFor(room, currentId).reveal, undefined);
  fiveSecond.onEvent(room, otherIds[1], { type: "judge", value: "nailed" });

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.success, true);
  assert.equal(state.reveal.nailed, 2);
  assert.equal(room.scores[currentId], 1);

  fiveSecond.onPhaseEnd(room);
  assert.equal(state.phase, "answer");
  assert.equal(state.round, 2);
});

test("five second times out without a point and moves to the next player", () => {
  const room = makeRoom(3, "lightning");
  const state = fiveSecond.init(room, "lightning");
  const firstId = state.currentPlayerId;

  fiveSecond.onPhaseEnd(room);
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.success, false);
  assert.equal(state.reveal.reason, "timeout");

  fiveSecond.onPhaseEnd(room);
  assert.equal(state.phase, "answer");
  assert.notEqual(state.currentPlayerId, firstId);
  assert.equal(room.scores[firstId], 0);
});

test("overrated scores the majority and gives everyone a point on a tie", () => {
  const room = makeRoom(4, "classic");
  const state = overrated.init(room, "classic");
  const ids = [...room.players.keys()];

  overrated.onEvent(room, ids[0], { type: "vote", value: "overrated" });
  overrated.onEvent(room, ids[1], { type: "vote", value: "overrated" });
  overrated.onEvent(room, ids[2], { type: "vote", value: "underrated" });
  overrated.onEvent(room, ids[3], { type: "vote", value: "underrated" });

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.tie, true);
  for (const id of ids) assert.equal(room.scores[id], 1);

  overrated.onPhaseEnd(room);
  const secondRound = state.round;
  assert.equal(secondRound, 2);
  overrated.onEvent(room, ids[0], { type: "vote", value: "overrated" });
  overrated.onEvent(room, ids[1], { type: "vote", value: "underrated" });
  overrated.onEvent(room, ids[2], { type: "vote", value: "underrated" });
  overrated.onEvent(room, ids[3], { type: "vote", value: "underrated" });

  assert.equal(state.reveal.majority, "underrated");
  assert.equal(state.reveal.tie, false);
  assert.equal(room.scores[ids[0]], 1);
  assert.equal(room.scores[ids[1]], 2);
});

test("phase 2 prompt banks meet their minimum sizes and ids are unique", () => {
  for (const [file, minimum] of [
    ["../data/prompts/impostor.json", 60],
    ["../data/prompts/fiveSecond.json", 80],
    ["../data/prompts/overrated.json", 60],
  ]) {
    const prompts = require(file);
    assert.ok(prompts.length >= minimum, `${file} has ${prompts.length}`);
    assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
    assert.ok(prompts.every((prompt) => prompt.text.trim().length > 0));
  }
});
