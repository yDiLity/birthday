-- UPDATE-политика telegram_pairings без WITH CHECK позволяла пользователю
-- обновить свою строку и «перенести» её на чужой user_id. Добавляем WITH CHECK,
-- как уже сделано для остальных пользовательских таблиц.

DROP POLICY IF EXISTS "Users can update their own pairings" ON telegram_pairings;
CREATE POLICY "Users can update their own pairings"
  ON telegram_pairings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
