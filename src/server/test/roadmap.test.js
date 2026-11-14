import assert from "node:assert/strict";
import { test } from "node:test";
import mostLikelyTo from "../games/mostLikelyTo.js";
import { containsProfanity, findProfanity } from "../lib/contentFilter.js";
import { buildLorePack } from "../lib/lore.js";
import { achievementRows, nextEloRating, rivalryPair } from "../lib/progression.js";
import { buildRecap, recapShareId } from "../lib/recap.js";

function makeRoom(count = 3) {
  const players = new Map();
  for (let index = 1; index <= count; index += 1) {
    players.set(`p${index}`, {
      id: `p${index}`,
      name: `P${index}`,
      userId: `user-${index}`,
      connected: true,
      joinedAt: index,
    });
  }
  return {
    id: "00000000-0000-4000-8000-000000000123",
    players,
    scores: {},
    mode: "classic",
    state: null,
    module: null,
    lorePack: null,
  };
}

test("profanity filtering scans user text but not identifiers", () => {
  assert.equal(containsProfanity("that was shit"), true);
  assert.equal(containsProfanity("ship it"), false);
  assert.equal(findProfanity({ type: "answer", value: "what the fuck" }), "what the fuck");
  assert.equal(findProfanity({ playerId: "fuck", type: "answer" }), null);
  assert.equal(
    findProfanity({ answers: [{ text: "clean" }, { text: "you asshole" }] }),
    "you asshole",
  );
});

test("recap builder records winner, scores and public moments", () => {
  const room = makeRoom(3);
  room.scores = { p1: 5, p2: 3, p3: 1 };
  room.module = {
    publicFor: () => ({ reveal: { answers: [{ text: "The funniest answer here" }] } }),
  };
  const ranking = [
    { playerId: "p1", name: "P1", score: 5 },
    { playerId: "p2", name: "P2", score: 3 },
    { playerId: "p3", name: "P3", score: 1 },
  ];
  const recap = buildRecap({ room, gameId: "bluff", mode: "classic", ranking, reason: "completed" });

  assert.match(recap.shareId, /^[a-z0-9]+-[a-z0-9]+$/);
  assert.equal(recap.shareId.split("-")[0], recapShareId(room.id).split("-")[0]);
  assert.equal(recap.winnerName, "P1");
  assert.equal(recap.scores[0].winner, true);
  assert.ok(recap.highlights.some((line) => line.includes("The funniest answer here")));
  assert.notEqual(recapShareId(room.id, 1_000), recapShareId(room.id, 2_000));
});

test("progression uses Elo and creates rivalry milestones", () => {
  assert.ok(nextEloRating({ rating: 1000, opponentRating: 1000, won: true }) > 1000);
  assert.ok(nextEloRating({ rating: 1000, opponentRating: 1000, won: false }) < 1000);
  assert.deepEqual(rivalryPair("z", "a"), ["a", "z"]);
  assert.deepEqual(
    achievementRows({ groupId: "g", userId: "u", rating: 1200, gamesPlayed: 10, wins: 5 }).map(
      (row) => row.key,
    ),
    ["first_win", "five_wins", "ten_games", "rating_1100", "rating_1200"],
  );
});

test("lore generation is local, filtered and needs enough prompts", () => {
  const pack = buildLorePack({
    groupName: "The Group",
    profiles: [
      {
        display_name: "Ada",
        traits: ["chaotic", "competitive"],
        habits: ["arrives late"],
        iconic_moments: ["the karaoke disaster"],
        catchphrases: ["trust me"],
        most_likely_to: ["start a group chat at 2am"],
      },
      {
        display_name: "Grace",
        traits: ["calm"],
        iconic_moments: ["this is shit"],
      },
    ],
    history: [
      { payload: { winners: ["Ada"], gameType: "bluff" } },
    ],
  });

  assert.ok(pack.prompts.length >= 5);
  assert.ok(pack.answers.length >= 2);
  assert.ok(pack.prompts.some((prompt) => prompt.text.includes("2am")));
  assert.ok(pack.prompts.every((prompt) => !containsProfanity(prompt.text)));
  assert.ok(pack.answers.every((answer) => !containsProfanity(answer.text)));
});

test("most likely to uses an approved lore pack and falls back to static prompts", () => {
  const room = makeRoom(3);
  room.lorePack = {
    prompts: Array.from({ length: 5 }, (_, index) => ({
      id: `lore-${index}`,
      text: `Who in The Group is most likely to lore ${index}?`,
    })),
  };
  mostLikelyTo.init(room, "classic");
  assert.ok(room.state.prompt.text.includes("lore"));

  const fallback = makeRoom(3);
  mostLikelyTo.init(fallback, "classic");
  assert.ok(!fallback.state.prompt.text.includes("lore"));
});
