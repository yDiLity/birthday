const DAY_MS = 86_400_000;

/** Календарные компоненты даты (месяц — 0-based), как в JS Date. */
export interface DateParts {
  year: number;
  month: number;
  date: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Порядковый номер дня по UTC — разница между такими номерами не зависит от DST. */
function dayIndex(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day) / DAY_MS;
}

function toDateParts(today: Date | DateParts): DateParts {
  if (today instanceof Date) {
    return {
      year: today.getFullYear(),
      month: today.getMonth(),
      date: today.getDate(),
    };
  }
  return today;
}

/**
 * Число дней до следующего дня рождения (0 = сегодня) в календаре, заданном `today`.
 * Родившиеся 29 февраля празднуют 28 февраля в невисокосные годы.
 */
export function daysUntilBirthday(
  birthDateStr: string,
  today: Date | DateParts = new Date(),
): number {
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) {
    return Number.MAX_SAFE_INTEGER;
  }

  const birthMonth = birth.getUTCMonth();
  const birthDay = birth.getUTCDate();
  const isFeb29 = birthMonth === 1 && birthDay === 29;
  const birthdayDay = (year: number) =>
    isFeb29 && !isLeapYear(year) ? 28 : birthDay;

  const { year, month, date } = toDateParts(today);
  const todayIdx = dayIndex(year, month, date);
  const thisYearIdx = dayIndex(year, birthMonth, birthdayDay(year));
  const nextYearIdx = dayIndex(year + 1, birthMonth, birthdayDay(year + 1));

  let diff = thisYearIdx - todayIdx;
  if (diff < 0) {
    diff = nextYearIdx - todayIdx;
  }
  return diff;
}
