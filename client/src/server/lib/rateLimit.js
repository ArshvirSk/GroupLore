const buckets = new Map();

/**
 * Small fixed-window limiter for in-process API/socket abuse protection.
 * Multi-instance deployments should move this to a shared store.
 */
export function allow(key, limit, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function joinLimiter(req, res, next) {
  const ipKey = `join:ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
  const userKey = `join:user:${req.user?.id || "anonymous"}`;
  if (!allow(ipKey, 20, 60_000) || !allow(userKey, 10, 60_000)) {
    return res.status(429).json({
      error: {
        code: "rate_limited",
        message: "Too many join attempts. Wait a minute and try again.",
      },
    });
  }
  return next();
}

export function socketRateLimit(socket, limit = 40, windowMs = 10_000) {
  const key = `socket:${socket.id}`;
  return allow(key, limit, windowMs);
}

// Bound the map in long-running processes.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref?.();
