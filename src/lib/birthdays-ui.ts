/**
 * Текст «Через N дней/дня/день» с правильным склонением.
 */
export function getDaysText(days: number): string {
  if (days === 0) return "Сегодня!";
  if (days === 1) return "Завтра";

  const lastDigit = days % 10;
  const lastTwoDigits = days % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `Через ${days} день`;
  }

  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
    return `Через ${days} дня`;
  }

  return `Через ${days} дней`;
}

/**
 * Цвет бейджа в зависимости от количества дней до ДР.
 */
export function getBadgeVariant(
  days: number,
): "default" | "secondary" | "destructive" | "outline" {
  if (days === 0) return "destructive";
  if (days <= 3) return "default";
  if (days <= 7) return "secondary";
  return "outline";
}
