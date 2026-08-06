import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { hasUpstashRateLimitEnv } from "@/lib/env";

interface RateLimitOptions {
  prefix: string;
  limit?: number;
  window?: Duration;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  prefix: "digital-birthday-reminder:api",
};

const instances = new Map<string, Ratelimit>();

export function getRateLimit(options: RateLimitOptions = DEFAULT_OPTIONS) {
  if (!hasUpstashRateLimitEnv()) {
    return null;
  }

  const { prefix, limit = 10, window = "1 m" } = options;
  const key = `${prefix}:${limit}:${window}`;
  const existing = instances.get(key);
  if (existing) {
    return existing;
  }

  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix,
  });

  instances.set(key, ratelimit);
  return ratelimit;
}
