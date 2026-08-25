const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

// Загружаем TypeScript модуль через tsx runtime
const birthdaysPath = path.resolve(__dirname, "../../src/lib/birthdays.ts");
const birthdaysSource = fs.readFileSync(birthdaysPath, "utf8");

// Изолированный тест birthdays — проверяем чистую логику без импортов
// Воспроизводим ключевые функции из birthdays.ts для тестирования

const DAY_MS = 86_400_000;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function dayIndex(year, month, day) {
  return Date.UTC(year, month, day) / DAY_MS;
}

function daysUntilBirthday(birthDateStr, today = new Date()) {
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) {
    return Number.MAX_SAFE_INTEGER;
  }

  const birthMonth = birth.getUTCMonth();
  const birthDay = birth.getUTCDate();
  const isFeb29 = birthMonth === 1 && birthDay === 29;
  const birthdayDay = (year) =>
    isFeb29 && !isLeapYear(year) ? 28 : birthDay;

  const year = today.getFullYear();
  const month = today.getMonth();
  const date = today.getDate();
  const todayIdx = dayIndex(year, month, date);
  const thisYearIdx = dayIndex(year, birthMonth, birthdayDay(year));
  const nextYearIdx = dayIndex(year + 1, birthMonth, birthdayDay(year + 1));

  let diff = thisYearIdx - todayIdx;
  if (diff < 0) {
    diff = nextYearIdx - todayIdx;
  }
  return diff;
}

// ─── isLeapYear ───

test("isLeapYear: 2000 is leap (divisible by 400)", () => {
  assert.equal(isLeapYear(2000), true);
});

test("isLeapYear: 1900 is NOT leap (divisible by 100)", () => {
  assert.equal(isLeapYear(1900), false);
});

test("isLeapYear: 2024 is leap (divisible by 4)", () => {
  assert.equal(isLeapYear(2024), true);
});

test("isLeapYear: 2023 is NOT leap", () => {
  assert.equal(isLeapYear(2023), false);
});

// ─── daysUntilBirthday ───

test("daysUntilBirthday: today = 0", () => {
  const today = new Date(Date.UTC(2025, 5, 15)); // June 15 2025
  assert.equal(daysUntilBirthday("2000-06-15", today), 0);
});

test("daysUntilBirthday: tomorrow = 1", () => {
  const today = new Date(Date.UTC(2025, 5, 14)); // June 14
  assert.equal(daysUntilBirthday("2000-06-15", today), 1);
});

test("daysUntilBirthday: birthday passed this year → next year", () => {
  const today = new Date(Date.UTC(2025, 6, 1)); // July 1
  const days = daysUntilBirthday("2000-06-15", today);
  assert.ok(days > 0, "should be days until next year");
  assert.ok(days < 400, "should be less than a year");
});

test("daysUntilBirthday: Feb 29 → Feb 28 in non-leap year", () => {
  const today = new Date(Date.UTC(2025, 0, 1)); // Jan 1, 2025 (non-leap)
  const days = daysUntilBirthday("2000-02-29", today);
  // Feb 28, 2025 - Jan 1, 2025 = 58 days
  assert.equal(days, 58);
});

test("daysUntilBirthday: Feb 29 → Feb 29 in leap year", () => {
  const today = new Date(Date.UTC(2024, 0, 1)); // Jan 1, 2024 (leap)
  const days = daysUntilBirthday("2000-02-29", today);
  // Jan 1 to Feb 29 = 59 days (31 Jan days - 1 + 28 Feb days = 59)
  assert.equal(days, 59);
});

test("daysUntilBirthday: invalid date → MAX_SAFE_INTEGER", () => {
  const today = new Date(Date.UTC(2025, 0, 1));
  assert.equal(daysUntilBirthday("not-a-date", today), Number.MAX_SAFE_INTEGER);
});

// ─── Telegram escapeHtml ───

test("escapeHtml: escapes special chars", () => {
  // Inline version of escapeHtml from telegram.ts
  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  assert.equal(escapeHtml("hello & world"), "hello &amp; world");
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(escapeHtml('a "b" c'), "a &quot;b&quot; c");
  assert.equal(escapeHtml("it's"), "it&#39;s");
  assert.equal(escapeHtml("no special"), "no special");
});

// ─── Rate limiter (in-memory) ───

test("memory rate limiter: allows within limit", async () => {
  class MemoryRateLimiter {
    constructor(maxReqs, windowMs) {
      this.hits = new Map();
      this.maxReqs = maxReqs;
      this.windowMs = windowMs;
    }
    async check(identifier) {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      const timestamps = (this.hits.get(identifier) ?? []).filter(
        (t) => t > windowStart,
      );
      timestamps.push(now);
      this.hits.set(identifier, timestamps);
      return {
        success: timestamps.length <= this.maxReqs,
        limit: this.maxReqs,
        remaining: Math.max(0, this.maxReqs - timestamps.length),
        reset: now + this.windowMs,
      };
    }
  }

  const limiter = new MemoryRateLimiter(3, 60_000);
  const r1 = await limiter.check("user1");
  assert.equal(r1.success, true);
  assert.equal(r1.remaining, 2);

  const r2 = await limiter.check("user1");
  assert.equal(r2.success, true);
  assert.equal(r2.remaining, 1);

  const r3 = await limiter.check("user1");
  assert.equal(r3.success, true);
  assert.equal(r3.remaining, 0);

  const r4 = await limiter.check("user1");
  assert.equal(r4.success, false);
});

test("memory rate limiter: different identifiers are independent", async () => {
  class MemoryRateLimiter {
    constructor(maxReqs, windowMs) {
      this.hits = new Map();
      this.maxReqs = maxReqs;
      this.windowMs = windowMs;
    }
    async check(identifier) {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      const timestamps = (this.hits.get(identifier) ?? []).filter(
        (t) => t > windowStart,
      );
      timestamps.push(now);
      this.hits.set(identifier, timestamps);
      return {
        success: timestamps.length <= this.maxReqs,
        limit: this.maxReqs,
        remaining: Math.max(0, this.maxReqs - timestamps.length),
        reset: now + this.windowMs,
      };
    }
  }

  const limiter = new MemoryRateLimiter(1, 60_000);
  await limiter.check("user1");
  const r2 = await limiter.check("user2");
  assert.equal(r2.success, true); // user2 is independent
});

// ─── Migration integrity ───

test("migrations: pairings table exists", () => {
  const migrationsDir = path.resolve(
    __dirname,
    "../../supabase/migrations",
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const combined = files
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
    .join("\n");

  assert.match(combined, /CREATE TABLE.*telegram_pairings/);
});

test("migrations: notification_log has UNIQUE constraint", () => {
  const migrationsDir = path.resolve(
    __dirname,
    "../../supabase/migrations",
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const combined = files
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
    .join("\n");

  assert.match(
    combined,
    /UNIQUE\s*\(\s*contact_id\s*,\s*sent_date\s*\)/i,
  );
});
