import bluff from "./bluff.js";
import fiveSecond from "./fiveSecond.js";
import hiveMind from "./hiveMind.js";
import hotTakes from "./hotTakes.js";
import impostor from "./impostor.js";
import mostLikelyTo from "./mostLikelyTo.js";
import oddOneOut from "./oddOneOut.js";
import overrated from "./overrated.js";
import stub from "./stub.js";

const registry = new Map();

export function registerGame(module) {
  if (!module?.id) throw new Error("Game module needs an id");
  if (!module.modes || !module.init || !module.viewFor) {
    throw new Error(`Game ${module.id} is missing required methods`);
  }
  registry.set(module.id, module);
  return module;
}

export function getGame(id) {
  return registry.get(id) || null;
}

export function listGames() {
  return [...registry.values()].filter((module) => !module.hidden);
}

registerGame(mostLikelyTo);
registerGame(impostor);
registerGame(fiveSecond);
registerGame(overrated);
registerGame(hiveMind);
registerGame(oddOneOut);
registerGame(bluff);
registerGame(hotTakes);
registerGame(stub);

export default registry;
