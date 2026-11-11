import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import acronymWars from "../games/acronymWars.js";
import madLibs from "../games/madLibs.js";
import pitchPerfect from "../games/pitchPerfect.js";
import roastBattle from "../games/roastBattle.js";
import twoTruths from "../games/twoTruths.js";

const require = createRequire(import.meta.url);

function makeRoom(count, mode = "classic") {
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

function submitAll(room, state) {
  for (const [slotId, slot] of Object.entries(state.assignments)) {
    roastBattle.onEvent(room, slot.playerId, {
      type: "answer",
      slotId,
      value: `answer for ${slotId.slice(0, 4)}`,
    });
  }
}

test("roast battle pairs everyone, hides authors, and awards unanimous wins", () => {
  const room = makeRoom(4);
  const state = roastBattle.init(room, "classic");

  assert.equal(state.phase, "write");
  assert.equal(state.round, 1);
  assert.equal(state.matchups.length, 2);
  assert.equal(Object.keys(state.assignments).length, 4);

  submitAll(room, state);
  assert.equal(state.phase, "duel");

  const first = state.matchups[0];
  const authors = first.entries.map((entry) => entry.playerId);
  const voters = [...room.players.keys()].filter((id) => !authors.includes(id));
  const voterView = roastBattle.viewFor(room, voters[0]);

  assert.equal("playerId" in voterView.matchup.answers[0], false);
  assert.equal(JSON.stringify(roastBattle.publicFor(room)).includes(authors[0]), false);

  roastBattle.onEvent(room, voters[0], {
    type: "vote",
    slotId: first.entries[0].id,
  });
  assert.equal(first.resolved, false);
  roastBattle.onEvent(room, voters[1], {
    type: "vote",
    slotId: first.entries[0].id,
  });

  assert.equal(first.resolved, true);
  assert.equal(room.scores[first.entries[0].playerId], 500);
  assert.equal(state.matchups[1].resolved, false);

  const second = state.matchups[1];
  const secondAuthors = second.entries.map((entry) => entry.playerId);
  const secondVoters = [...room.players.keys()].filter((id) => !secondAuthors.includes(id));
  for (const voterId of secondVoters) {
    roastBattle.onEvent(room, voterId, {
      type: "vote",
      slotId: second.entries[1].id,
    });
  }

  assert.equal(state.phase, "reveal");
  assert.equal(second.reveal.entries[1].votes, 2);
  assert.equal(room.scores[second.entries[1].playerId], 500);
  assert.equal(state.reveal.roundPoints.length, 2);

  roastBattle.onPhaseEnd(room);
  assert.equal(state.phase, "write");
  assert.equal(state.round, 2);
});

test("roast battle forfeits unanswered duels and cannot deadlock on a leave", () => {
  const room = makeRoom(4);
  const state = roastBattle.init(room, "classic");
  submitAll(room, state);

  const first = state.matchups[0];
  const leavingAuthor = first.entries[0].playerId;
  room.players.delete(leavingAuthor);
  roastBattle.onPlayerLeave(room, leavingAuthor);

  assert.equal(first.resolved, true);
  assert.equal(first.reveal.entries[0].forfeited, true);
  assert.equal(first.reveal.entries[1].points, 100);
  assert.equal(state.done, false);

  room.players.delete(first.entries[1].playerId);
  roastBattle.onPlayerLeave(room, first.entries[1].playerId);
  assert.equal(state.done, true);
});

test("acronym wars validates every word and hides authors until the reveal", () => {
  const room = makeRoom(3);
  const state = acronymWars.init(room, "classic");
  const acronym = (letters, suffix) =>
    letters.map((letter) => `${letter}${suffix}`).join(" ");

  assert.equal(state.phase, "write");
  assert.ok(state.letters.length >= 3 && state.letters.length <= 5);
  assert.throws(
    () => acronymWars.onEvent(room, "p1", { type: "answer", value: "onlyoneword" }),
    /exactly/i,
  );

  acronymWars.onEvent(room, "p1", {
    type: "answer",
    value: acronym(state.letters, "alpha"),
  });
  acronymWars.onEvent(room, "p2", {
    type: "answer",
    value: acronym(state.letters, "bravo"),
  });
  acronymWars.onEvent(room, "p3", {
    type: "answer",
    value: acronym(state.letters, "charlie"),
  });

  assert.equal(state.phase, "vote");
  assert.equal("playerId" in acronymWars.viewFor(room, "p1").choices[0], false);
  assert.equal(JSON.stringify(acronymWars.publicFor(room)).includes("p2"), false);

  const p2Choice = state.choices.find((choice) => choice.playerId === "p2");
  const p3Choice = state.choices.find((choice) => choice.playerId === "p3");
  assert.throws(
    () => acronymWars.onEvent(room, "p2", { type: "vote", choiceId: p2Choice.id }),
    /own/i,
  );

  acronymWars.onEvent(room, "p1", { type: "vote", choiceId: p2Choice.id });
  acronymWars.onEvent(room, "p2", { type: "vote", choiceId: p3Choice.id });
  acronymWars.onEvent(room, "p3", { type: "vote", choiceId: p2Choice.id });

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.choices[0].votes, 2);
  assert.equal(room.scores.p2, 425);
  assert.equal(room.scores.p1, 25);
  assert.equal(room.scores.p3, 125);

  acronymWars.onPhaseEnd(room);
  assert.equal(state.phase, "write");
  assert.equal(state.round, 2);
});

test("acronym wars ends cleanly when a player leaves", () => {
  const room = makeRoom(3);
  const state = acronymWars.init(room, "speed");
  room.players.delete("p1");
  assert.equal(acronymWars.onPlayerLeave(room, "p1"), "results");
  assert.equal(state.done, true);
});

test("pitch perfect hides authors and doubles the final round", () => {
  const room = makeRoom(3);
  const state = pitchPerfect.init(room, "quick");
  state.round = state.rounds;

  pitchPerfect.onEvent(room, "p1", { type: "pitch", value: "It solves everything." });
  pitchPerfect.onEvent(room, "p2", { type: "pitch", value: "Buy it for your enemy." });
  pitchPerfect.onEvent(room, "p3", { type: "pitch", value: "It is slightly less bad." });

  assert.equal(state.phase, "vote");
  assert.equal("playerId" in pitchPerfect.viewFor(room, "p1").choices[0], false);
  assert.equal(JSON.stringify(pitchPerfect.publicFor(room)).includes("p2"), false);

  const p2Choice = state.choices.find((choice) => choice.playerId === "p2");
  const p3Choice = state.choices.find((choice) => choice.playerId === "p3");
  assert.throws(
    () => pitchPerfect.onEvent(room, "p2", { type: "vote", choiceId: p2Choice.id }),
    /own/i,
  );

  pitchPerfect.onEvent(room, "p1", { type: "vote", choiceId: p2Choice.id });
  pitchPerfect.onEvent(room, "p2", { type: "vote", choiceId: p3Choice.id });
  pitchPerfect.onEvent(room, "p3", { type: "vote", choiceId: p2Choice.id });

  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.multiplier, 2);
  assert.equal(room.scores.p2, 1000);
  assert.equal(room.scores.p3, 200);
  assert.equal(pitchPerfect.onPhaseEnd(room), "results");
});

test("pitch perfect ends cleanly when a player leaves", () => {
  const room = makeRoom(3);
  const state = pitchPerfect.init(room, "classic");
  room.players.delete("p1");
  assert.equal(pitchPerfect.onPlayerLeave(room, "p1"), "results");
  assert.equal(state.done, true);
});

test("mad libs fills blind blanks, rates them, and hides ratings", () => {
  const room = makeRoom(3);
  const state = madLibs.init(room, "classic");

  assert.equal(state.phase, "fill");
  assert.equal(state.blanks.length, 9);
  for (const playerId of room.players.keys()) {
    assert.equal(state.blanks.filter((blank) => blank.playerId === playerId).length, 3);
  }

  state.blanks.forEach((blank, index) => {
    madLibs.onEvent(room, blank.playerId, {
      type: "fill",
      blankId: blank.id,
      value: `word${index}`,
    });
  });
  assert.equal(state.phase, "read");
  assert.ok(
    madLibs
      .viewFor(room, "p1")
      .segments.some((segment) => segment.type === "blank" && segment.value === "word0"),
  );

  madLibs.onPhaseEnd(room);
  assert.equal(state.phase, "rate");
  assert.equal("playerId" in madLibs.publicFor(room).segments[0], false);
  assert.equal(JSON.stringify(madLibs.publicFor(room)).includes("ratings"), false);

  for (const playerId of room.players.keys()) {
    for (const blank of state.blanks.filter((item) => item.playerId !== playerId)) {
      madLibs.onEvent(room, playerId, {
        type: "rate",
        blankId: blank.id,
        value: 4,
      });
    }
  }

  assert.equal(state.phase, "reveal");
  for (const playerId of room.players.keys()) assert.equal(room.scores[playerId], 400);
  assert.equal(state.reveal.blanks.length, 9);
  assert.equal(state.reveal.blanks[0].average, 4);

  madLibs.onPhaseEnd(room);
  assert.equal(state.phase, "fill");
  assert.equal(state.round, 2);
});

test("mad libs ends cleanly when a player leaves", () => {
  const room = makeRoom(3);
  const state = madLibs.init(room, "classic");
  room.players.delete("p1");
  assert.equal(madLibs.onPlayerLeave(room, "p1"), "results");
  assert.equal(state.done, true);
});

test("two truths hides the lie until the reveal and scores both sides", () => {
  const room = makeRoom(3);
  const state = twoTruths.init(room, "classic");
  state.order = ["p1", "p2", "p3"];

  for (const playerId of room.players.keys()) {
    twoTruths.onEvent(room, playerId, {
      type: "submit",
      statements: [`${playerId} truth one`, `${playerId} truth two`, `${playerId} lie`],
      lieIndex: 2,
    });
  }

  assert.equal(state.phase, "vote");
  assert.equal(state.subjectId, "p1");
  assert.equal("isLie" in twoTruths.viewFor(room, "p2").statements[0], false);
  assert.equal(JSON.stringify(twoTruths.publicFor(room)).includes("isLie"), false);
  assert.equal("lieIndex" in twoTruths.viewFor(room, "p1"), false);

  const truth = state.statements.find((statement) => !statement.isLie);
  const lie = state.statements.find((statement) => statement.isLie);
  assert.throws(
    () => twoTruths.onEvent(room, "p1", { type: "vote", statementId: lie.id }),
    /own/i,
  );
  twoTruths.onEvent(room, "p2", { type: "vote", statementId: truth.id });
  twoTruths.onEvent(room, "p3", { type: "vote", statementId: lie.id });

  assert.equal(state.phase, "reveal");
  assert.equal(room.scores.p1, 100);
  assert.equal(room.scores.p3, 100);
  assert.equal(room.scores.p2, 0);
  assert.equal(state.reveal.fooled.length, 1);
  assert.equal(state.reveal.correctGuessers.length, 1);

  twoTruths.onPhaseEnd(room);
  assert.equal(state.phase, "vote");
  assert.equal(state.subjectId, "p2");
});

test("two truths ends cleanly when a player leaves", () => {
  const room = makeRoom(3);
  const state = twoTruths.init(room, "classic");
  room.players.delete("p1");
  assert.equal(twoTruths.onPlayerLeave(room, "p1"), "results");
  assert.equal(state.done, true);
});

test("roast battle prompt bank meets its minimum and has unique ids", () => {
  const prompts = require("../data/prompts/roastBattle.json");
  assert.ok(prompts.length >= 150);
  assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
  assert.ok(prompts.every((prompt) => prompt.text.trim().length > 0));
});

test("pitch perfect prompt bank meets its minimum and has unique ids", () => {
  const prompts = require("../data/prompts/pitchPerfect.json");
  assert.ok(prompts.length >= 100);
  assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
  assert.ok(prompts.every((prompt) => prompt.text.trim().length > 0));
});

test("mad libs bank has 25 stories with nine unique placeholders each", () => {
  const stories = require("../data/prompts/madLibs.json");
  assert.ok(stories.length >= 25);
  assert.equal(new Set(stories.map((story) => story.id)).size, stories.length);
  const blankIds = new Set();
  for (const story of stories) {
    assert.equal(story.blanks.length, 9);
    for (let index = 0; index < 9; index += 1) {
      assert.ok(story.template.includes(`{${index}}`), `${story.id} missing {${index}}`);
    }
    for (const blank of story.blanks) {
      assert.ok(blank.hint.trim().length > 0);
      assert.equal(blankIds.has(blank.id), false);
      blankIds.add(blank.id);
    }
  }
});

test("two truths hint bank meets its minimum and has unique ids", () => {
  const prompts = require("../data/prompts/twoTruths.json");
  assert.ok(prompts.length >= 40);
  assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
  assert.ok(prompts.every((prompt) => prompt.text.trim().length > 0));
});

test("acronym wars prompt bank meets its minimum and has unique ids", () => {
  const prompts = require("../data/prompts/acronymWars.json");
  assert.ok(prompts.length >= 60);
  assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
  assert.ok(prompts.every((prompt) => prompt.text.trim().length > 0));
});
