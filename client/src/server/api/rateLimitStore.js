const globalStore = globalThis;

const buckets =
  globalStore.__grouploreRateLimits ??
  (globalStore.__grouploreRateLimits = new Map());

export function allow(key, limit, windowMs, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}
