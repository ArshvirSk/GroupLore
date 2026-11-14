import acronymWars from "./acronymWars.js";
import avoidTheAnswer from "./avoidTheAnswer.js";
import blindSketch from "./blindSketch.js";
import blurGuess from "./blurGuess.js";
import bluff from "./bluff.js";
import boggleRush from "./boggleRush.js";
import buzzerTrivia from "./buzzerTrivia.js";
import captionThis from "./captionThis.js";
import categoryRush from "./categoryRush.js";
import codenames from "./codenames.js";
import connections from "./connections.js";
import duelBracket from "./duelBracket.js";
import fiveSecond from "./fiveSecond.js";
import factOrFiction from "./factOrFiction.js";
import fillTheBlank from "./fillTheBlank.js";
import higherLower from "./higherLower.js";
import hiveMind from "./hiveMind.js";
import hotTakes from "./hotTakes.js";
import impostor from "./impostor.js";
import liarsBar from "./liarsBar.js";
import liarsDice from "./liarsDice.js";
import madLibs from "./madLibs.js";
import mostLikelyTo from "./mostLikelyTo.js";
import oddOneOut from "./oddOneOut.js";
import overrated from "./overrated.js";
import password from "./password.js";
import patternMemory from "./patternMemory.js";
import pitchPerfect from "./pitchPerfect.js";
import reactionDuel from "./reactionDuel.js";
import roastBattle from "./roastBattle.js";
import scattergories from "./scattergories.js";
import stub from "./stub.js";
import storyChain from "./storyChain.js";
import surveySays from "./surveySays.js";
import twoTruths from "./twoTruths.js";
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
registerGame(madLibs);
registerGame(twoTruths);
registerGame(factOrFiction);
registerGame(fillTheBlank);
registerGame(connections);
registerGame(surveySays);
registerGame(scattergories);
registerGame(patternMemory);
registerGame(reactionDuel);
registerGame(storyChain);
registerGame(password);
registerGame(boggleRush);
registerGame(buzzerTrivia);
registerGame(liarsDice);
registerGame(blurGuess);
registerGame(codenames);
registerGame(blindSketch);
registerGame(duelBracket);
registerGame(stub);

export default registry;
