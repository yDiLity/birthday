/**
 * Единая база поздравлений пользователя.
 * Тексты удалены по просьбе владельца — новые будут добавлены позже
 * (через UI или напрямую в массив ниже).
 */
const congratulations: string[] = [];

/** Строки для первичного заполнения пула поздравлений пользователя. */
export function buildSeedRows(
  userId: string,
): Array<{ user_id: string; text: string }> {
  return congratulations.map((text) => ({ user_id: userId, text }));
}
