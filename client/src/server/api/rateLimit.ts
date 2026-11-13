import "server-only";
import type { NextRequest } from "next/server";
import { ApiFailure } from "./http";
import { requestIp } from "./auth";
import { allow } from "./rateLimitStore.js";

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
