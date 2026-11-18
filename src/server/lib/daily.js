export function dailyKey(now = new Date()) {
  return new Date(now).toISOString().slice(0, 10);
}

function hashKey(key) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function dailyIndex(length, key = dailyKey()) {
  if (!Number.isInteger(length) || length < 1) return -1;
  return hashKey(String(key)) % length;
}

export function seededShuffle(items, key = dailyKey()) {
  const shuffled = [...items];
  let seed = hashKey(String(key)) || 1;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}
