import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import bluff from "../games/bluff.js";
import hiveMind from "../games/hiveMind.js";
import hotTakes from "../games/hotTakes.js";
import oddOneOut from "../games/oddOneOut.js";

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

function answerAll(module, room, answers) {
  for (const [playerId, value] of Object.entries(answers)) {
    module.onEvent(room, playerId, { type: "answer", value });
  }
}

test("hive mind groups fuzzy matches and scores the group size", () => {
  const room = makeRoom(3, "classic");
  const state = hiveMind.init(room, "classic");

  answerAll(hiveMind, room, {
    p1: "Pizza",
    p2: "pizza ",
    p3: "burger",
  });

  assert.equal(state.phase, "reveal");
  assert.equal(state.groups.length, 2);
  const pizza = state.groups.find(
    (group) => group.answer.trim().toLowerCase() === "pizza",
  );
  assert.equal(pizza.playerIds.length, 2);
  assert.equal(pizza.points, 2);
  assert.equal(room.scores.p1, 2);
  assert.equal(room.scores.p2, 2);
  assert.equal(room.scores.p3, 0);

  const view = hiveMind.viewFor(room, "p3");
  assert.equal(view.yourAnswer, "burger");
  assert.equal(view.groups.length, 2);

  hiveMind.onPhaseEnd(room);
  assert.equal(state.phase, "answer");
  assert.equal(state.round, 2);
});

test("odd one out gives different prompts and hides both from the TV", () => {
  const room = makeRoom(4, "classic");
  const state = oddOneOut.init(room, "classic");
  const oddId = state.oddPlayerId;
  const crewId = [...room.players.keys()].find((id) => id !== oddId);

  const crewView = oddOneOut.viewFor(room, crewId);
  const oddView = oddOneOut.viewFor(room, oddId);
  assert.notEqual(crewView.prompt, oddView.prompt);
  assert.equal(crewView.isOdd, false);
  assert.equal(oddView.isOdd, true);
  assert.equal(JSON.stringify(crewView).includes(state.prompt.odd), false);

  const publicAnswer = oddOneOut.publicFor(room);
  assert.equal("prompt" in publicAnswer, false);
  assert.equal(JSON.stringify(publicAnswer).includes(state.prompt.text), false);

  answerAll(oddOneOut, room, {
    p1: "answer one",
    p2: "answer two",
    p3: "answer three",
    p4: "answer four",
  });
  assert.equal(state.phase, "discussion");
  oddOneOut.onPhaseEnd(room);
  assert.equal(state.phase, "vote");

  for (const playerId of room.players.keys()) {
    oddOneOut.onEvent(room, playerId, {
      type: "vote",
      targetPlayerId: playerId === oddId ? crewId : oddId,
    });
  }

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.caught, true);
  assert.equal(room.scores[oddId], 0);
  for (const playerId of room.players.keys()) {
    if (playerId !== oddId) assert.equal(room.scores[playerId], 1);
  }
});

test("bluff mixes real and fake answers and rejects self-votes", () => {
  const room = makeRoom(3, "classic");
  const state = bluff.init(room, "classic");
  const realAnswer = state.prompt.answer;

  bluff.onEvent(room, "p1", { type: "bluff", value: "fake one" });
  bluff.onEvent(room, "p2", { type: "bluff", value: "fake two" });
  bluff.onEvent(room, "p3", { type: "bluff", value: realAnswer });

  assert.equal(state.phase, "vote");
  assert.equal(state.choices.length, 3);
  assert.equal(state.exactMatches.includes("p3"), true);

  const p1View = bluff.viewFor(room, "p1");
  const p2Choice = p1View.choices.find((choice) => choice.text === "fake two");
  const realChoice = state.choices.find((choice) => choice.authors.length === 0);
  assert.ok(p2Choice);
  assert.ok(realChoice);
  assert.equal("authors" in p1View.choices[0], false);
  assert.equal(p1View.myChoiceId, state.choices.find((choice) => choice.authors.includes("p1")).id);

  assert.throws(
    () =>
      bluff.onEvent(room, "p1", {
        type: "vote",
        choiceId: p1View.myChoiceId,
      }),
    /own bluff/i,
  );

  bluff.onEvent(room, "p1", { type: "vote", choiceId: p2Choice.id });
  bluff.onEvent(room, "p2", { type: "vote", choiceId: realChoice.id });
  bluff.onEvent(room, "p3", { type: "vote", choiceId: p1View.myChoiceId });

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.realAnswer, realAnswer);
  assert.equal(room.scores.p1, 1);
  assert.equal(room.scores.p2, 3);
  assert.equal(room.scores.p3, 1);
});

test("hot takes rewards the minority and splits ties", () => {
  const room = makeRoom(4, "classic");
  const state = hotTakes.init(room, "classic");

  hotTakes.onEvent(room, "p1", { type: "vote", value: "agree" });
  hotTakes.onEvent(room, "p2", { type: "vote", value: "agree" });
  hotTakes.onEvent(room, "p3", { type: "vote", value: "agree" });
  hotTakes.onEvent(room, "p4", { type: "vote", value: "disagree" });

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.minority, "disagree");
  assert.equal(room.scores.p1, 1);
  assert.equal(room.scores.p2, 1);
  assert.equal(room.scores.p3, 1);
  assert.equal(room.scores.p4, 2);

  hotTakes.onPhaseEnd(room);
  hotTakes.onEvent(room, "p1", { type: "vote", value: "agree" });
  hotTakes.onEvent(room, "p2", { type: "vote", value: "agree" });
  hotTakes.onEvent(room, "p3", { type: "vote", value: "disagree" });
  hotTakes.onEvent(room, "p4", { type: "vote", value: "disagree" });

  assert.equal(state.reveal.tie, true);
  assert.equal(room.scores.p1, 2);
  assert.equal(room.scores.p2, 2);
  assert.equal(room.scores.p3, 2);
  assert.equal(room.scores.p4, 3);
});

test("phase 3 prompt banks have the required sizes and unique ids", () => {
  for (const [file, minimum] of [
    ["../data/prompts/hive.json", 150],
    ["../data/prompts/bluff.json", 60],
    ["../data/prompts/hotTakes.json", 80],
  ]) {
    const prompts = require(file);
    assert.ok(prompts.length >= minimum, `${file} has ${prompts.length}`);
    assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
  }

  for (const prompt of require("../data/prompts/hive.json")) {
    assert.ok(prompt.text.trim().length > 0);
    assert.ok(prompt.odd.trim().length > 0);
  }
});
