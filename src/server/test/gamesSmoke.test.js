import assert from "node:assert/strict";
import { test } from "node:test";
import { listGames } from "../games/index.js";
import { autoBalance } from "../engine/teams.js";

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
    id: "smoke-session",
    groupId: "smoke-group",
    players,
    mode,
    scores: Object.fromEntries([...players.keys()].map((id) => [id, 0])),
    state: null,
    teams: null,
  };
}

test("every public game module initializes and renders a player view", () => {
  const games = listGames();
  assert.equal(games.length, 36);

  for (const game of games) {
    const mode = game.modes.classic
      ? "classic"
      : Object.keys(game.modes)[0];
    assert.ok(mode, `${game.id} has no modes`);

    const playerCount = Math.max(3, game.minPlayers);
    const room = makeRoom(playerCount, mode);
    if (game.teams) room.teams = autoBalance([...room.players.keys()], 2);
    const state = game.init(room, mode);

    assert.ok(state && typeof state === "object", `${game.id} did not initialize`);
    assert.equal(typeof game.viewFor, "function", `${game.id} lacks viewFor`);
    assert.equal(typeof game.publicFor, "function", `${game.id} lacks publicFor`);

    const playerId = [...room.players.keys()][0];
    assert.ok(
      game.viewFor(room, playerId) && typeof game.viewFor(room, playerId) === "object",
      `${game.id} did not render a player view`,
    );
    assert.ok(
      game.publicFor(room) && typeof game.publicFor(room) === "object",
      `${game.id} did not render a public view`,
    );
  }
});
