import acronymWars from "./acronymWars.js";
import avoidTheAnswer from "./avoidTheAnswer.js";
import bluff from "./bluff.js";
import captionThis from "./captionThis.js";
import categoryRush from "./categoryRush.js";
import fiveSecond from "./fiveSecond.js";
import higherLower from "./higherLower.js";
import hiveMind from "./hiveMind.js";
import hotTakes from "./hotTakes.js";
import impostor from "./impostor.js";
import liarsBar from "./liarsBar.js";
import mostLikelyTo from "./mostLikelyTo.js";
import oddOneOut from "./oddOneOut.js";
import overrated from "./overrated.js";
import pitchPerfect from "./pitchPerfect.js";
import roastBattle from "./roastBattle.js";
import stub from "./stub.js";
import wavelength from "./wavelength.js";
import wouldYouRather from "./wouldYouRather.js";

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
registerGame(liarsBar);
registerGame(higherLower);
registerGame(avoidTheAnswer);
registerGame(wouldYouRather);
registerGame(captionThis);
registerGame(wavelength);
registerGame(categoryRush);
registerGame(hiveMind);
registerGame(oddOneOut);
registerGame(bluff);
registerGame(hotTakes);
registerGame(roastBattle);
registerGame(acronymWars);
registerGame(pitchPerfect);
registerGame(stub);

export default registry;
