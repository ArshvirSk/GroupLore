import { shuffle } from "../../utils/helpers.js";

/**
 * A chain starts with one player and advances to the next player after every
 * entry. The owner never sees their own chain again until the final reveal.
 */
export function createChains(playerIds, starters, { random = Math.random } = {}) {
  const order = shuffle(playerIds, random);
  return order.map((ownerId, index) => ({
    id: `chain-${index + 1}`,
    starter: starters[index % starters.length],
    entries: [],
    ownerId,
    currentPlayerId: ownerId,
    complete: false,
  }));
}

export function advanceChain(chain, playerIds, text, authorId) {
  if (chain.complete) return chain;
  chain.entries.push({
    playerId: authorId,
    text,
    at: Date.now(),
  });
  const index = playerIds.indexOf(chain.currentPlayerId);
  const next = playerIds[(index + 1) % playerIds.length];
  if (next === chain.ownerId || chain.entries.length >= playerIds.length) {
    chain.complete = true;
    chain.currentPlayerId = null;
  } else {
    chain.currentPlayerId = next;
  }
  return chain;
}

export function visibleChain(chain) {
  return {
    id: chain.id,
    starter: chain.starter,
    entries: chain.entries.map((entry, index) => ({
      index,
      text: entry.text,
      playerId: entry.playerId,
    })),
    complete: chain.complete,
  };
}
