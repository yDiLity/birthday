import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { hasUpstashRateLimitEnv } from "@/lib/env";

interface RateLimitOptions {
  prefix: string;
  limit?: number;
  window?: Duration;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  prefix: "digital-birthday-reminder:api",
};

const instances = new Map<string, Ratelimit>();

/**
 * Common interface for both Upstash and in-memory rate limiters.
 */
interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

/**
 * In-memory sliding-window rate limiter — fallback когда Upstash не настроен.
 * Хранит таймстемпы запросов в Map, автоматически чистит устаревшие.
 */
class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.hits.get(identifier) ?? [];
    const valid = timestamps.filter((t) => t > windowStart);
    valid.push(now);
    this.hits.set(identifier, valid);

    const remaining = Math.max(0, this.maxRequests - valid.length);
    const reset = now + this.windowMs;

    return {
      success: valid.length <= this.maxRequests,
      limit: this.maxRequests,
      remaining,
      reset,
    };
  }
}

/** Парсит Duration-строку ("1 m", "10 s") в миллисекунды. */
function parseDuration(d: Duration): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(d);
  if (!match) return 60_000;
  const n = Number.parseInt(match[1], 10);
  switch (match[2]) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    case "d":
      return n * 86_400_000;
    default:
      return 60_000;
  }
}

/**
 * Возвращает экземпляр rate limiter:
 * - Если Upstash настроен → использует Redis (распределённый, точный)
 * - Если нет → in-memory fallback (работает в одном инстансе, достаточно для Hobby)
 */
export function getRateLimit(options: RateLimitOptions = DEFAULT_OPTIONS): RateLimiter | null {
  const { prefix, limit = 10, window = "1 m" } = options;
  const key = `${prefix}:${limit}:${window}`;

  // Upstash доступен — используем распределённый rate limiter
  if (hasUpstashRateLimitEnv()) {
    const existing = instances.get(key);
    if (existing) return existing;

    const ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, window),
      analytics: true,
      prefix,
    });

    instances.set(key, ratelimit);
    return ratelimit;
  }

  // Fallback: in-memory rate limiter (singleton per key)
  const memKey = `mem:${key}`;
  const existingMem = memoryLimiters.get(memKey);
  if (existingMem) return existingMem;

  const limiter = new MemoryRateLimiter(limit, parseDuration(window));
  memoryLimiters.set(memKey, limiter);
  return limiter;
}

const memoryLimiters = new Map<string, MemoryRateLimiter>();
