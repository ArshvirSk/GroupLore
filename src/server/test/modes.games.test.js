import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { getGame } from "../games/index.js";
import chameleon from "../games/chameleon.js";
import spyfall from "../games/spyfall.js";
import closestWins from "../games/closestWins.js";
import timeline from "../games/timeline.js";
import rankIt from "../games/rankIt.js";
import speedTrivia from "../games/speedTrivia.js";
import flagRush from "../games/flagRush.js";
import emojiDecode from "../games/emojiDecode.js";
import justOne from "../games/justOne.js";
import splitOrSteal from "../games/splitOrSteal.js";
import auctionBluff from "../games/auctionBluff.js";
import bombParty from "../games/bombParty.js";
import wordChain from "../games/wordChain.js";
import typeRace from "../games/typeRace.js";
import wordleRace from "../games/wordleRace.js";
import hotPotato from "../games/hotPotato.js";
import theMind from "../games/theMind.js";
import drawGuess from "../games/drawGuess.js";
import drawTelephone from "../games/drawTelephone.js";
import badArtist from "../games/badArtist.js";
import werewolf from "../games/werewolf.js";
import resistance from "../games/resistance.js";

const require = createRequire(import.meta.url);
const WORDS = require("../data/boggleWords.json");

const NEW_GAMES = [
  "chameleon", "spyfall", "closest-wins", "timeline", "rank-it",
  "speed-trivia", "flag-rush", "emoji-decode", "just-one",
  "split-or-steal", "auction-bluff", "bomb-party", "word-chain",
  "type-race", "wordle-race", "hot-potato", "the-mind", "draw-guess",
  "draw-telephone", "bad-artist", "werewolf", "resistance",
];

function makeRoom(count, mode = "classic") {
  const players = new Map();
  for (let index = 0; index < count; index += 1) {
    const id = `p${index + 1}`;
    players.set(id, { id, name: `Player ${index + 1}`, connected: true, joinedAt: index });
  }
  return {
    id: "session-modes",
    groupId: "group-modes",
    players,
    mode,
    scores: Object.fromEntries([...players.keys()].map((id) => [id, 0])),
    state: null,
  };
}

function wordWithPrompt(prompt, exclude = []) {
  return WORDS.find((word) => word.length >= 3 && word.includes(prompt) && !exclude.includes(word));
}

test("every MODES game is registered", () => {
  for (const id of NEW_GAMES) assert.ok(getGame(id), `${id} is not registered`);
});

test("chameleon hides the word and pays the voters who catch the chameleon", () => {
  const room = makeRoom(4);
  const state = chameleon.init(room, "classic");
  const chameleonView = chameleon.viewFor(room, state.chameleonId);
  assert.equal(chameleonView.secret, null);
  const otherId = [...room.players.keys()].find((id) => id !== state.chameleonId);
  assert.equal(chameleon.viewFor(room, otherId).secret, state.card.secret);

  for (const id of room.players.keys()) chameleon.onEvent(room, id, { type: "clue", value: `clue ${id}` });
  assert.equal(state.phase, "vote");
  for (const id of room.players.keys()) {
    if (id !== state.chameleonId) chameleon.onEvent(room, id, { type: "vote", targetId: state.chameleonId });
  }
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.caught, true);
  assert.equal(room.scores[otherId], 150);
});

test("spyfall resolves a caught spy and a wrong location guess", () => {
  const room = makeRoom(5);
  const state = spyfall.init(room, "classic");
  spyfall.onEvent(room, [...room.players.keys()][0], { type: "callVote" });
  for (const id of room.players.keys()) {
    const targetId = id === state.spyId ? [...room.players.keys()].find((other) => other !== id) : state.spyId;
    spyfall.onEvent(room, id, { type: "vote", targetId });
  }
  assert.equal(state.phase, "spyGuess");
  spyfall.onEvent(room, state.spyId, { type: "guess", value: "not this place" });
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.caught, true);
  assert.equal(state.reveal.correctGuess, false);
  for (const id of room.players.keys()) {
    if (id !== state.spyId) assert.equal(room.scores[id], 100);
  }
});

test("closest wins ranks estimates and awards the nearest", () => {
  const room = makeRoom(3);
  const state = closestWins.init(room, "classic");
  const answer = state.question.answer;
  const guesses = [answer + 10, answer + 50, answer - 10];
  [...room.players.keys()].forEach((id, index) => closestWins.onEvent(room, id, { type: "guess", value: guesses[index] }));
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.entries[0].value, answer - 10);
  assert.equal(room.scores.p3, 200);
});

test("timeline and rank it score submitted orders", () => {
  const room = makeRoom(3);
  const state = timeline.init(room, "classic");
  assert.equal(typeof timeline.viewFor(room, "p1").items[0], "string");
  const chronological = [...state.card.items].sort((a, b) => a.value - b.value).map((item) => item.label);
  for (const id of room.players.keys()) timeline.onEvent(room, id, { type: "order", order: chronological });
  assert.equal(state.phase, "reveal");
  assert.equal(room.scores.p1, 350);

  const rankRoom = makeRoom(3);
  const rankState = rankIt.init(rankRoom, "classic");
  assert.equal(typeof rankIt.viewFor(rankRoom, "p1").items[0], "string");
  const ranked = [...rankState.card.items].sort((a, b) => b.value - a.value).map((item) => item.label);
  for (const id of rankRoom.players.keys()) rankIt.onEvent(rankRoom, id, { type: "order", order: ranked });
  assert.equal(rankState.phase, "reveal");
  assert.equal(rankRoom.scores.p1, 400);
});

test("speed trivia, flag rush and emoji decode reveal answers after all submit", () => {
  const triviaRoom = makeRoom(2);
  const triviaState = speedTrivia.init(triviaRoom, "classic");
  for (const id of triviaRoom.players.keys()) speedTrivia.onEvent(triviaRoom, id, { type: "answer", value: triviaState.question.answer });
  assert.equal(triviaState.phase, "reveal");
  assert.ok(triviaRoom.scores.p1 >= 300);

  const flagRoom = makeRoom(2);
  const flagState = flagRush.init(flagRoom, "classic");
  for (const id of flagRoom.players.keys()) flagRush.onEvent(flagRoom, id, { type: "answer", value: flagState.flag.answer });
  assert.equal(flagState.phase, "reveal");
  assert.ok(flagRoom.scores.p1 > 0);

  const emojiRoom = makeRoom(2);
  const emojiState = emojiDecode.init(emojiRoom, "classic");
  for (const id of emojiRoom.players.keys()) emojiDecode.onEvent(emojiRoom, id, { type: "answer", value: emojiState.puzzle.answer });
  assert.equal(emojiState.phase, "reveal");
  assert.equal(emojiRoom.scores.p1, 200);
});

test("just one cancels duplicate clues and rewards a correct guess", () => {
  const room = makeRoom(4);
  const state = justOne.init(room, "classic");
  const writers = [...room.players.keys()].filter((id) => id !== state.guesserId);
  justOne.onEvent(room, writers[0], { type: "clue", value: "first" });
  justOne.onEvent(room, writers[1], { type: "clue", value: "first" });
  justOne.onEvent(room, writers[2], { type: "clue", value: "third" });
  assert.equal(state.phase, "guess");
  assert.equal(state.validClues.length, 1);
  justOne.onEvent(room, state.guesserId, { type: "guess", value: state.word.word });
  assert.equal(state.phase, "reveal");
  assert.equal(state.reveal.correct, true);
  assert.equal(room.scores[state.guesserId], 2);
  assert.equal(room.scores[writers[0]], 1);
});

test("split or steal and auction bluff resolve secret choices", () => {
  const splitRoom = makeRoom(4);
  const splitState = splitOrSteal.init(splitRoom, "classic");
  for (const pair of splitState.pairs) {
    splitOrSteal.onEvent(splitRoom, pair.playerIds[0], { type: "choose", value: "split" });
    splitOrSteal.onEvent(splitRoom, pair.playerIds[1], { type: "choose", value: "split" });
  }
  assert.equal(splitState.phase, "reveal");
  assert.equal(splitRoom.scores.p1, 3);

  const auctionRoom = makeRoom(3);
  const auctionState = auctionBluff.init(auctionRoom, "classic");
  for (const id of auctionRoom.players.keys()) auctionBluff.onEvent(auctionRoom, id, { type: "bid", value: 20 });
  assert.equal(auctionState.phase, "reveal");
  assert.equal(auctionState.reveal.winner.playerId, "p1");
  assert.equal(auctionRoom.scores.p1, 100 + auctionState.lot.value - 20);
});

test("word games accept real dictionary words and pass turns", () => {
  const bombRoom = makeRoom(3);
  const bombState = bombParty.init(bombRoom, "classic");
  const bombWord = wordWithPrompt(bombState.prompt);
  assert.ok(bombWord, "no dictionary word for the bomb prompt");
  bombParty.onEvent(bombRoom, "p1", { type: "word", word: bombWord });
  assert.equal(bombState.usedWords.length, 1);
  assert.equal(bombState.turnIndex, 1);
  bombParty.onPhaseEnd(bombRoom);
  assert.equal(bombState.lives.p2, 2);

  const chainRoom = makeRoom(2);
  const chainState = wordChain.init(chainRoom, "classic");
  const chainWord = WORDS.find((word) => word.startsWith(chainState.lastWord.slice(-1)) && !chainState.usedWords.includes(word));
  wordChain.onEvent(chainRoom, "p1", { type: "word", word: chainWord });
  assert.equal(chainState.lastWord, chainWord);
  assert.equal(chainState.turnIndex, 1);
});

test("type race and wordle race score correct submissions", () => {
  const raceRoom = makeRoom(2);
  const raceState = typeRace.init(raceRoom, "classic");
  for (const id of raceRoom.players.keys()) typeRace.onEvent(raceRoom, id, { type: "text", value: raceState.passage.text });
  assert.equal(raceState.phase, "reveal");
  assert.equal(raceState.reveal.rows[0].accuracy, 100);
  assert.ok(raceRoom.scores.p1 >= 1000);

  const wordleRoom = makeRoom(2);
  const wordleState = wordleRace.init(wordleRoom, "classic");
  for (const id of wordleRoom.players.keys()) wordleRace.onEvent(wordleRoom, id, { type: "guess", word: wordleState.answer });
  assert.equal(wordleState.phase, "reveal");
  assert.ok(wordleRoom.scores.p1 >= 600);
});

test("hot potato passes the bomb and the mind completes levels in order", () => {
  const potatoRoom = makeRoom(3);
  const potatoState = hotPotato.init(potatoRoom, "classic");
  const firstHolder = potatoState.holderId;
  const target = potatoState.aliveIds.find((id) => id !== firstHolder);
  hotPotato.onEvent(potatoRoom, firstHolder, { type: "pass", targetId: target });
  assert.equal(potatoState.holderId, target);
  assert.equal(potatoRoom.scores[firstHolder], 15);
  hotPotato.onPhaseEnd(potatoRoom);
  assert.equal(potatoState.lives[target], 2);

  const mindRoom = makeRoom(3);
  const mindState = theMind.init(mindRoom, "classic");
  const cards = [];
  for (const [playerId, hand] of Object.entries(mindState.hands)) {
    for (const value of hand) cards.push({ playerId, value });
  }
  cards.sort((a, b) => a.value - b.value);
  for (const card of cards) theMind.onEvent(mindRoom, card.playerId, { type: "play", value: card.value });
  assert.equal(mindState.level, 2);
  assert.equal(mindState.lives, 3);
  assert.ok(Object.values(mindRoom.scores).every((score) => score > 0));
});

test("drawing games accept strokes and resolve correct guesses", () => {
  const drawRoom = makeRoom(3);
  const drawState = drawGuess.init(drawRoom, "classic");
  drawGuess.onEvent(drawRoom, drawState.drawerId, { type: "chooseWord", wordId: drawState.choices[0].id });
  const guessers = [...drawRoom.players.keys()].filter((id) => id !== drawState.drawerId);
  for (const id of guessers) drawGuess.onEvent(drawRoom, id, { type: "guess", value: drawState.word.text });
  assert.equal(drawState.phase, "reveal");
  assert.equal(drawState.correctIds.length, 2);

  const badRoom = makeRoom(3);
  const badState = badArtist.init(badRoom, "classic");
  const badGuessers = [...badRoom.players.keys()].filter((id) => id !== badState.artistId);
  for (const id of badGuessers) badArtist.onEvent(badRoom, id, { type: "guess", value: badState.prompt.text });
  assert.equal(badState.phase, "reveal");

  const phoneRoom = makeRoom(3);
  const phoneState = drawTelephone.init(phoneRoom, "classic");
  for (const id of phoneRoom.players.keys()) drawTelephone.onEvent(phoneRoom, id, { type: "done" });
  assert.equal(phoneState.phase, "guess");
  for (const id of phoneRoom.players.keys()) drawTelephone.onEvent(phoneRoom, id, { type: "guess", value: `guess ${id}` });
  assert.equal(phoneState.phase, "reveal");
  assert.equal(phoneState.reveal.rows.length, 3);
});

test("werewolf resolves the night and resistance resolves an approved mission", () => {
  const wolfRoom = makeRoom(5);
  const wolfState = werewolf.init(wolfRoom, "classic");
  const wolfId = Object.keys(wolfState.roles).find((id) => wolfState.roles[id] === "werewolf");
  const seerId = Object.keys(wolfState.roles).find((id) => wolfState.roles[id] === "seer");
  const victim = wolfState.aliveIds.find((id) => id !== wolfId && id !== seerId);
  werewolf.onEvent(wolfRoom, wolfId, { type: "kill", targetId: victim });
  const inspectTarget = wolfState.aliveIds.find((id) => id !== seerId);
  werewolf.onEvent(wolfRoom, seerId, { type: "inspect", targetId: inspectTarget });
  werewolf.onPhaseEnd(wolfRoom);
  assert.equal(wolfState.phase, "day");
  assert.equal(wolfState.lastNight.diedId, victim);
  assert.equal(wolfState.inspections[seerId].length, 1);

  const spyRoom = makeRoom(5);
  const spyState = resistance.init(spyRoom, "classic");
  const leader = spyState.leaderId;
  const team = spyState.order.filter((id) => id !== leader).slice(0, 2);
  resistance.onEvent(spyRoom, leader, { type: "team", playerIds: team });
  assert.equal(spyState.phase, "vote");
  for (const id of spyRoom.players.keys()) resistance.onEvent(spyRoom, id, { type: "vote", value: "approve" });
  assert.equal(spyState.phase, "mission");
  for (const id of team) resistance.onEvent(spyRoom, id, { type: "mission", value: "success" });
  assert.equal(spyState.phase, "reveal");
  assert.deepEqual(spyState.missionResults, [true]);
});
