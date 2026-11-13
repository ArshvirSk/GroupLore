import type { NextRequest } from "next/server";
import { ApiFailure } from "./http";
import { requestIp } from "./auth";

type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as typeof globalThis & {
  __grouploreRateLimits?: Map<string, Bucket>;
};

const buckets =
  globalStore.__grouploreRateLimits ??
  (globalStore.__grouploreRateLimits = new Map<string, Bucket>());

export function allow(key: string, limit: number, windowMs: number) {
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

export function enforceJoinLimit(request: NextRequest, userId: string) {
  const ipKey = `join:ip:${requestIp(request)}`;
  const userKey = `join:user:${userId}`;
  if (!allow(ipKey, 20, 60_000) || !allow(userKey, 10, 60_000)) {
    throw new ApiFailure(
      429,
      "rate_limited",
      "Too many join attempts. Wait a minute and try again.",
    );
  }
}
