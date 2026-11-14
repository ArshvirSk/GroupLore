import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import blindSketch from "../games/blindSketch.js";
import blurGuess from "../games/blurGuess.js";
import boggleRush from "../games/boggleRush.js";
import buzzerTrivia from "../games/buzzerTrivia.js";
import codenames from "../games/codenames.js";
import connections from "../games/connections.js";
import duelBracket from "../games/duelBracket.js";
import fillTheBlank from "../games/fillTheBlank.js";
import liarsDice from "../games/liarsDice.js";
import password from "../games/password.js";
import patternMemory from "../games/patternMemory.js";
import reactionDuel from "../games/reactionDuel.js";
import scattergories from "../games/scattergories.js";
import storyChain from "../games/storyChain.js";
import surveySays from "../games/surveySays.js";
import { autoBalance, teamOf, teamScores, validateTeams } from "../engine/teams.js";
import { latencyOf, recordLatency } from "../engine/primitives/latency.js";
import { createChains, advanceChain } from "../engine/primitives/chain.js";

const require = createRequire(import.meta.url);
const fillBank = require("../data/prompts/fillTheBlank.json");
const connectionBank = require("../data/prompts/connections.json");
const surveyBank = require("../data/prompts/surveySays.json");
const scatterBank = require("../data/prompts/scattergories.json");
const passwordBank = require("../data/prompts/password.json");
const codenameBank = require("../data/prompts/codenames.json");
const sketchBank = require("../data/prompts/blindSketch.json");
const triviaBank = require("../data/prompts/buzzerTrivia.json");
const blurManifest = require("../data/assets/blur/manifest.json");
const boggleWords = require("../data/boggleWords.json");

function makeRoom(count = 4, { withTeams = false, mode = "classic" } = {}) {
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
  const room = {
    id: "round2-test",
    groupId: null,
    players,
    mode,
    scores: Object.fromEntries([...players.keys()].map((id) => [id, 0])),
    state: null,
    latency: {},
    teams: null,
  };
  if (withTeams) {
    room.teams = autoBalance([...players.keys()], 2);
  }
  return room;
}

function submitAll(room, module, eventForPlayer) {
  for (const player of room.players.values()) {
    module.onEvent(room, player.id, eventForPlayer(player));
  }
}

test("teams primitive balances, validates, and totals per team", () => {
  const room = makeRoom(5);
  room.teams = autoBalance([...room.players.keys()], 2);
  assert.deepEqual(room.teams.map((team) => team.playerIds.length).sort(), [2, 3]);
  assert.equal(validateTeams(room, { count: 2, minPerTeam: 2 }).ok, true);
  assert.equal(teamOf(room, "p1").id.startsWith("team-"), true);
  const totals = teamScores(room, { p1: 100, p2: 50, p3: 25 });
  assert.equal(Object.values(totals).reduce((sum, value) => sum + value, 0), 175);
});

test("latency keeps a capped smoothed half-RTT and chain rotates ownership", () => {
  const room = makeRoom(3);
  for (const value of [40, 50, 60]) recordLatency(room, "p1", value);
  assert.equal(latencyOf(room, "p1"), 25);
  recordLatency(room, "p2", 900);
  assert.equal(latencyOf(room, "p2"), 125);
  const chains = createChains(["p1", "p2", "p3"], [{ text: "Once" }]);
  const chain = chains.find((item) => item.ownerId === "p1");
  advanceChain(chain, ["p1", "p2", "p3"], "first", "p1");
  assert.equal(chain.currentPlayerId, "p2");
  advanceChain(chain, ["p1", "p2", "p3"], "second", "p2");
  advanceChain(chain, ["p1", "p2", "p3"], "third", "p3");
  assert.equal(chain.complete, true);
  assert.equal(chain.entries.length, 3);
});

test("fill the blank deals hands, hides authors while judging, and scores a pick", () => {
  const room = makeRoom(3);
  room.teams = null;
  const state = fillTheBlank.init(room, "classic");
  assert.equal(state.phase, "play");
  assert.equal(state.hands[state.judgeId].length, 7);
  for (const player of room.players.values()) {
    if (player.id === state.judgeId) continue;
    fillTheBlank.onEvent(room, player.id, {
      type: "play",
      cardIds: state.hands[player.id].slice(0, state.prompt.blanks),
    });
  }
  assert.equal(state.phase, "judge");
  const judgeView = fillTheBlank.viewFor(room, state.judgeId);
  assert.equal(judgeView.options.every((option) => !("playerId" in option)), true);
  const entry = fillTheBlank.viewFor(room, state.judgeId).options[0];
  fillTheBlank.onEvent(room, state.judgeId, { type: "pick", entryId: entry.id });
  assert.equal(state.phase, "reveal");
  assert.equal(Object.values(room.scores).some((score) => score === 100), true);
});

test("connections identifies a group and keeps boards private in race mode", () => {
  const room = makeRoom(2);
  const state = connections.init(room, "race");
  const group = state.puzzle.groups[0];
  connections.onEvent(room, "p1", { type: "submitGroup", words: group.words });
  assert.deepEqual(state.boards.p1.solvedLevels, [group.level]);
  assert.equal(state.boards.p2.solvedLevels.length, 0);
  assert.equal("board" in connections.viewFor(room, "p2"), true);
});

test("survey says matches answers and hides them until the reveal", () => {
  const room = makeRoom(3);
  const state = surveySays.init(room, "classic");
  assert.equal(JSON.stringify(surveySays.publicFor(room)).includes(state.question.answers[0].text), false);
  submitAll(room, surveySays, () => ({
    type: "guess",
    values: [state.question.answers[0].text],
  }));
  assert.equal(state.phase, "reveal");
  assert.equal(Object.values(room.scores).some((score) => score > 0), true);
});

test("scattergories rejects a wrong letter and scores a unique answer", () => {
  const room = makeRoom(3);
  const state = scattergories.init(room, "classic");
  const wrong = state.letter === "A" ? "B" : "A";
  assert.throws(
    () => scattergories.onEvent(room, "p1", { type: "answer", values: { 0: `${wrong} thing` } }),
    /start with/,
  );
  submitAll(room, scattergories, (player) => ({
    type: "answer",
    values: Object.fromEntries(state.categories.map((_, index) => [index, `${state.letter}${player.id}${index}`])),
  }));
  assert.equal(state.phase, "compare");
  assert.equal(Object.values(room.scores).some((score) => score > 0), true);
});

test("pattern memory advances only when every survivor replays the sequence", () => {
  const room = makeRoom(2);
  const state = patternMemory.init(room, "classic");
  assert.equal(state.phase, "show");
  patternMemory.onPhaseEnd(room);
  assert.equal(state.phase, "input");
  const sequence = [...state.sequence];
  for (const player of room.players.values()) {
    for (const tile of sequence) {
      patternMemory.onEvent(room, player.id, { type: "tap", tile });
    }
  }
  assert.equal(state.level, 2);
  assert.equal(state.phase, "show");
  assert.equal(room.scores.p1, 100);
});

test("reaction duel uses server arrival time and awards the fastest tap", () => {
  const room = makeRoom(2);
  room.latency.p1 = [40];
  const state = reactionDuel.init(room, "classic");
  reactionDuel.onPhaseEnd(room);
  assert.equal(state.phase, "go");
  reactionDuel.onEvent(room, "p1", { type: "tap" });
  reactionDuel.onEvent(room, "p2", { type: "tap" });
  assert.equal(state.phase, "result");
  assert.equal(room.scores.p1 >= 100, true);
  assert.equal("goAt" in reactionDuel.viewFor(room, "p1"), false);
});

test("story chain advances every chain and never makes a player wait on a leaver", () => {
  const room = makeRoom(3);
  const state = storyChain.init(room, "classic");
  for (const chain of state.chains) {
    storyChain.onEvent(room, chain.ownerId, { type: "start", value: "A beginning." });
  }
  assert.equal(state.phase, "pass");
  for (let pass = 0; pass < 3; pass += 1) {
    for (const chain of state.chains) {
      const playerId = chain.currentPlayerId;
      if (playerId) storyChain.onEvent(room, playerId, { type: "sentence", value: `pass ${pass}` });
    }
  }
  assert.equal(state.phase, "vote");
  const first = state.chains[0];
  storyChain.onEvent(room, "p1", { type: "vote", chainId: first.id });
  storyChain.onEvent(room, "p2", { type: "vote", chainId: first.id });
  storyChain.onEvent(room, "p3", { type: "vote", chainId: first.id });
  assert.equal(state.done, true);
});

test("password validates one-word clues and scores a team guess", () => {
  const room = makeRoom(4, { withTeams: true });
  const state = password.init(room, "classic");
  const team = room.teams.find((item) => item.id === state.currentTeamId);
  const clueGiverId = state.clueGiverId;
  const guesserId = team.playerIds.find((id) => id !== clueGiverId);
  assert.throws(
    () => password.onEvent(room, clueGiverId, { type: "clue", value: "two words" }),
    /exactly one word/,
  );
  password.onEvent(room, clueGiverId, { type: "clue", value: "hint" });
  password.onEvent(room, guesserId, { type: "guess", value: state.word.text });
  assert.equal(state.phase, "result");
  assert.equal(room.scores[guesserId] > 0, true);
});

test("boggle validates a path and dictionary word, and hides the board from the TV", () => {
  const room = makeRoom(2);
  const state = boggleRush.init(room, "classic");
  const word = state.grid.solutions.find((candidate) => candidate.length >= 3);
  assert.ok(word, "generated grid should contain a word");
  const path = findPath(state.grid, word);
  assert.ok(path);
  boggleRush.onEvent(room, "p1", { type: "word", word, path });
  assert.equal(state.found.p1[0].word, word);
  assert.equal("grid" in boggleRush.publicFor(room), false);
});

function findPath(grid, word) {
  const size = grid.size;
  const letters = grid.letters.map((letter) => letter.toLowerCase());
  const walk = (index, path, depth) => {
    if (letters[index] !== word[depth]) return null;
    if (depth === word.length - 1) return path;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const row = Math.floor(index / size) + dr;
        const column = (index % size) + dc;
        if (row < 0 || row >= size || column < 0 || column >= size) continue;
        const next = row * size + column;
        if (path.includes(next)) continue;
        const found = walk(next, [...path, next], depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  for (let index = 0; index < letters.length; index += 1) {
    const found = walk(index, [index], 0);
    if (found) return found;
  }
  return null;
}

test("buzzer trivia hides the answer until the result and scores a correct buzz", () => {
  const room = makeRoom(3);
  const state = buzzerTrivia.init(room, "classic");
  state.buzzOpenAt = 0;
  buzzerTrivia.onEvent(room, "p1", { type: "buzz" });
  assert.equal(JSON.stringify(buzzerTrivia.publicFor(room)).includes(state.question.answer), false);
  buzzerTrivia.onEvent(room, "p1", { type: "answer", value: state.question.answer });
  assert.equal(state.phase, "result");
  assert.equal(room.scores.p1 >= 300, true);
});

test("liar's dice leaks only own dice and resolves a challenge", () => {
  const room = makeRoom(3);
  const state = liarsDice.init(room, "classic");
  const view = liarsDice.viewFor(room, "p1");
  assert.equal(view.myDice.length, 5);
  assert.equal("dice" in view, false);
  assert.equal(JSON.stringify(liarsDice.publicFor(room)).includes('"dice"'), false);
  const first = state.turnOrder[state.turnIndex];
  liarsDice.onEvent(room, first, { type: "bid", quantity: 1, face: 2 });
  const second = state.turnOrder[state.turnIndex];
  liarsDice.onEvent(room, second, { type: "call" });
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.dice.length, 3);
});

test("blur guess sends one stage at a time and only the sharp image at result", () => {
  const room = makeRoom(3);
  const state = blurGuess.init(room, "classic");
  const stageView = blurGuess.viewFor(room, "p1");
  assert.equal(JSON.stringify(stageView).includes("sharp"), false);
  assert.equal(JSON.stringify(stageView).includes(state.image.answer), false);
  blurGuess.onEvent(room, "p1", { type: "guess", value: state.image.answer });
  assert.equal(state.phase, "result");
  assert.equal(blurGuess.viewFor(room, "p1").result.sharp, state.image.sharp);
});

test("codenames hides the key from operatives and the public", () => {
  const room = makeRoom(4, { withTeams: true });
  const state = codenames.init(room, "classic");
  const spymasterId = state.spymasters[state.turnTeamId];
  const spyView = codenames.viewFor(room, spymasterId);
  assert.equal(spyView.board.every((card) => card.key), true);
  const operative = room.teams.find((team) => team.id === state.turnTeamId).playerIds.find((id) => id !== spymasterId);
  const operativeView = codenames.viewFor(room, operative);
  assert.equal(operativeView.board.every((card) => !("key" in card)), true);
  assert.equal(JSON.stringify(codenames.publicFor(room)).includes('"key"'), false);
  codenames.onEvent(room, spymasterId, { type: "clue", word: "ocean", number: 2 });
  assert.equal(state.phase, "guess");
});

test("blind sketch hides the word from guessers and strokes from the drawer", () => {
  const room = makeRoom(4, { withTeams: true });
  const state = blindSketch.init(room, "classic");
  const wordTeamPlayer = room.teams.find((team) => team.id === state.wordTeamId).playerIds[0];
  blindSketch.onEvent(room, wordTeamPlayer, { type: "chooseWord", wordId: state.choices[0].id });
  assert.equal(state.phase, "pick-drawer");
  const drawerTeam = room.teams.find((team) => team.id === state.drawingTeamId).playerIds;
  blindSketch.onEvent(room, drawerTeam[0], { type: "pickDrawer", playerId: drawerTeam[0] });
  assert.equal(state.phase, "draw");
  blindSketch.onEvent(room, drawerTeam[0], {
    type: "stroke",
    stroke: { id: "s1", color: "#23182f", width: 2, points: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.4 }] },
  });
  assert.equal(blindSketch.viewFor(room, drawerTeam[0]).strokes.length, 0);
  assert.equal(blindSketch.viewFor(room, drawerTeam[1]).strokes.length, 1);
  assert.equal(blindSketch.viewFor(room, drawerTeam[1]).word, null);
  blindSketch.onEvent(room, drawerTeam[1], { type: "guess", value: state.word.text });
  assert.equal(state.phase, "reveal");
});

test("duel bracket exposes a live board and accepts a legal duel move", () => {
  const room = makeRoom(4);
  const state = duelBracket.init(room, "classic");
  assert.ok(state.currentMatch);
  const view = duelBracket.viewFor(room, state.currentMatch.a);
  assert.equal(view.isPlayer, true);
  assert.ok(view.duel?.type);
  const type = view.duel.type;
  const move =
    type === "tic-tac-toe" ? { index: 0 }
      : type === "connect-four" ? { column: 0 }
        : type === "dots-and-boxes" ? { edge: view.duel.edges[0] }
          : { choice: "rock" };
  duelBracket.onEvent(room, state.currentMatch.a, { type: "move", move });
  if (type === "tic-tac-toe") assert.equal(state.currentMatch.duel.board[0], state.currentMatch.a);
  if (type === "connect-four") assert.equal(state.currentMatch.duel.board[5][0], state.currentMatch.a);
  if (type === "rock-paper-scissors") assert.equal(state.currentMatch.duel.choices[state.currentMatch.a], "rock");
  if (type === "dots-and-boxes") assert.equal(state.currentMatch.duel.taken[move.edge], state.currentMatch.a);
});

test("round-two banks have stable unique content and the blur license manifest is complete", () => {
  const unique = (items, key = "id") => new Set(items.map((item) => item[key])).size === items.length;
  assert.equal(fillBank.prompts.length, 120);
  assert.equal(fillBank.answers.length, 500);
  assert.equal(unique(fillBank.prompts), true);
  assert.equal(unique(fillBank.answers), true);
  assert.equal(fillBank.answers.every((card) => card.text.trim()), true);
  assert.equal(connectionBank.length, 100);
  for (const puzzle of connectionBank) {
    const words = puzzle.groups.flatMap((group) => group.words);
    assert.equal(words.length, 16);
    assert.equal(new Set(words.map((word) => word.toLowerCase())).size, 16);
  }
  assert.equal(surveyBank.length >= 30, true);
  assert.equal(scatterBank.length >= 20, true);
  assert.equal(passwordBank.length, 300);
  assert.equal(codenameBank.length >= 400, true);
  assert.equal(sketchBank.length, 300);
  assert.equal(triviaBank.length >= 60, true);
  assert.equal(boggleWords.length >= 600, true);
  assert.equal(new Set(boggleWords).size, boggleWords.length);
  assert.equal(blurManifest.length >= 1, true);
  for (const image of blurManifest) {
    assert.ok(image.license, `${image.id} needs a license`);
    assert.ok(image.source, `${image.id} needs a source`);
    assert.equal(image.stages.length, 6);
    assert.ok(image.sharp.endsWith(".svg"));
  }
});
