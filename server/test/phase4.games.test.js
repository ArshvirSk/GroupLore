import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import avoidTheAnswer from "../games/avoidTheAnswer.js";
import captionThis from "../games/captionThis.js";
import categoryRush from "../games/categoryRush.js";
import higherLower from "../games/higherLower.js";
import liarsBar from "../games/liarsBar.js";
import wavelength from "../games/wavelength.js";
import wouldYouRather from "../games/wouldYouRather.js";

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

test("liars bar hides the truth and awards the group for catching a lie", () => {
  const room = makeRoom(4, "classic");
  const state = liarsBar.init(room, "classic");
  const liarId = state.liarId;
  const others = [...room.players.keys()].filter((id) => id !== liarId);

  assert.equal(state.phase, "choose");
  assert.equal(typeof liarsBar.viewFor(room, liarId).prompt.truth, "string");
  assert.equal(liarsBar.viewFor(room, others[0]).prompt, undefined);
  assert.equal(JSON.stringify(liarsBar.publicFor(room)).includes(state.prompt.truth), false);

  liarsBar.onEvent(room, liarId, { type: "choose", value: "lie" });
  assert.equal(state.phase, "vote");

  for (const playerId of others) {
    liarsBar.onEvent(room, playerId, { type: "vote", value: "lie" });
  }

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.wasLie, true);
  assert.equal(state.reveal.groupCorrect, true);
  assert.equal(room.scores[liarId], 0);
  for (const playerId of others) assert.equal(room.scores[playerId], 1);

  liarsBar.onPhaseEnd(room);
  assert.equal(state.phase, "choose");
  assert.equal(state.round, 2);
});

test("higher lower ranks the room and awards correct calls", () => {
  const room = makeRoom(3, "classic");
  const state = higherLower.init(room, "classic");

  assert.equal(state.phase, "poll");
  higherLower.onEvent(room, "p1", { type: "ratings", ratings: { p2: 8, p3: 2 } });
  higherLower.onEvent(room, "p2", { type: "ratings", ratings: { p1: 4, p3: 6 } });
  higherLower.onEvent(room, "p3", { type: "ratings", ratings: { p1: 5, p2: 7 } });

  assert.equal(state.phase, "guess");
  assert.equal(state.rankings.length, 3);
  assert.equal(higherLower.publicFor(room).nextScore, undefined);

  const current = state.rankings[0];
  const next = state.rankings[1];
  const correct = next.score >= current.score ? "higher" : "lower";
  for (const playerId of room.players.keys()) {
    higherLower.onEvent(room, playerId, { type: "guess", value: correct });
  }

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.correctAnswer, correct);
  assert.equal(state.reveal.current.playerId, current.playerId);
  assert.equal(state.reveal.next.playerId, next.playerId);
  for (const playerId of room.players.keys()) {
    assert.equal(room.scores[playerId], 1);
  }
});

test("avoid the answer rejects banned words and awards the guesser and describer", () => {
  const room = makeRoom(3, "classic");
  const state = avoidTheAnswer.init(room, "classic");
  const describerId = state.describerId;
  const guesserId = [...room.players.keys()].find((id) => id !== describerId);
  const target = state.prompt.word;

  assert.equal(avoidTheAnswer.viewFor(room, describerId).target, target);
  assert.equal(avoidTheAnswer.viewFor(room, guesserId).target, null);
  assert.equal("target" in avoidTheAnswer.publicFor(room), false);

  assert.throws(
    () =>
      avoidTheAnswer.onEvent(room, describerId, {
        type: "clue",
        value: `It is a ${state.prompt.banned[0]}`,
      }),
    /banned/i,
  );

  avoidTheAnswer.onEvent(room, describerId, {
    type: "clue",
    value: "It is something you might find on a holiday",
  });
  assert.equal(state.clues.length, 1);

  avoidTheAnswer.onEvent(room, guesserId, { type: "guess", value: target });
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.winnerId, guesserId);
  assert.equal(room.scores[guesserId], 2);
  assert.equal(room.scores[describerId], 1);
});

test("would you rather awards the majority and splits ties", () => {
  const room = makeRoom(4, "classic");
  const state = wouldYouRather.init(room, "classic");

  wouldYouRather.onEvent(room, "p1", { type: "vote", value: "a" });
  wouldYouRather.onEvent(room, "p2", { type: "vote", value: "a" });
  wouldYouRather.onEvent(room, "p3", { type: "vote", value: "a" });
  wouldYouRather.onEvent(room, "p4", { type: "vote", value: "b" });

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.majority, "a");
  assert.equal(room.scores.p1, 1);
  assert.equal(room.scores.p2, 1);
  assert.equal(room.scores.p3, 1);
  assert.equal(room.scores.p4, 0);

  wouldYouRather.onPhaseEnd(room);
  wouldYouRather.onEvent(room, "p1", { type: "vote", value: "a" });
  wouldYouRather.onEvent(room, "p2", { type: "vote", value: "b" });
  wouldYouRather.onEvent(room, "p3", { type: "vote", value: "a" });
  wouldYouRather.onEvent(room, "p4", { type: "vote", value: "b" });

  assert.equal(state.reveal.tie, true);
  assert.equal(room.scores.p1, 2);
  assert.equal(room.scores.p2, 2);
  assert.equal(room.scores.p3, 2);
  assert.equal(room.scores.p4, 1);
});

test("caption this hides authors until the vote and awards caption votes", () => {
  const room = makeRoom(3, "classic");
  const state = captionThis.init(room, "classic");

  captionThis.onEvent(room, "p1", { type: "caption", value: "caption one" });
  captionThis.onEvent(room, "p2", { type: "caption", value: "caption two" });
  captionThis.onEvent(room, "p3", { type: "caption", value: "caption three" });

  assert.equal(state.phase, "vote");
  const p1View = captionThis.viewFor(room, "p1");
  assert.equal("authors" in p1View.choices[0], false);
  const p2Choice = state.choices.find((choice) => choice.playerId === "p2");
  const p3Choice = state.choices.find((choice) => choice.playerId === "p3");
  assert.ok(p2Choice);
  assert.ok(p3Choice);

  assert.throws(
    () => captionThis.onEvent(room, "p1", { type: "vote", choiceId: p1View.myCaptionId }),
    /own caption/i,
  );
  captionThis.onEvent(room, "p1", { type: "vote", choiceId: p2Choice.id });
  captionThis.onEvent(room, "p2", { type: "vote", choiceId: p3Choice.id });
  captionThis.onEvent(room, "p3", { type: "vote", choiceId: p2Choice.id });

  assert.equal(state.phase, "reveal");
  assert.equal(room.scores.p2, 2);
  assert.equal(room.scores.p3, 1);
  assert.equal(room.scores.p1, 0);
});

test("wavelength keeps the target secret until the reveal and scores closeness", () => {
  const room = makeRoom(3, "classic");
  const state = wavelength.init(room, "classic");
  const clueGiverId = state.clueGiverId;
  const guessers = [...room.players.keys()].filter((id) => id !== clueGiverId);

  assert.equal(wavelength.viewFor(room, clueGiverId).target, state.target);
  assert.equal(wavelength.viewFor(room, guessers[0]).target, null);
  assert.equal("target" in wavelength.publicFor(room), false);

  wavelength.onEvent(room, clueGiverId, { type: "clue", value: "somewhere in the middle" });
  assert.equal(state.phase, "guess");

  for (const playerId of guessers) {
    wavelength.onEvent(room, playerId, { type: "guess", value: state.target });
  }

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.average, state.target);
  assert.equal(state.reveal.distance, 0);
  assert.equal(room.scores[clueGiverId], 2);
  for (const playerId of guessers) assert.equal(room.scores[playerId], 2);
});

test("category rush enforces the letter and rewards unique answers", () => {
  const room = makeRoom(3, "classic");
  const state = categoryRush.init(room, "classic");
  const letter = state.prompt.letter;

  assert.throws(
    () => categoryRush.onEvent(room, "p1", { type: "answer", value: "zzz" }),
    /start with/i,
  );

  categoryRush.onEvent(room, "p1", { type: "answer", value: `${letter} unique one` });
  categoryRush.onEvent(room, "p2", { type: "answer", value: `${letter} shared` });
  categoryRush.onEvent(room, "p3", { type: "answer", value: `${letter} shared` });

  assert.equal(state.phase, "reveal");
  assert.equal(room.scores.p1, 2);
  assert.equal(room.scores.p2, 1);
  assert.equal(room.scores.p3, 1);
});

test("phase 4 prompt banks meet their minimum sizes and ids are unique", () => {
  for (const [file, minimum] of [
    ["../data/prompts/liarsBar.json", 20],
    ["../data/prompts/higherLower.json", 20],
    ["../data/prompts/avoidTheAnswer.json", 20],
    ["../data/prompts/wouldYouRather.json", 20],
    ["../data/prompts/captionThis.json", 20],
    ["../data/prompts/wavelength.json", 20],
    ["../data/prompts/categoryRush.json", 20],
  ]) {
    const prompts = require(file);
    assert.ok(prompts.length >= minimum, `${file} has ${prompts.length}`);
    assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
  }
});
