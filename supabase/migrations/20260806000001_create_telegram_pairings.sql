-- Временные связки «аккаунт сайта ↔ Telegram» для флоу «подключить без токена».
-- Флоу: сайт генерирует code → человек жмёт Start в личке с ботом (telegram_id
-- записывается по совпадению кода) → человек добавляет бота в группу и пишет
-- там сообщение (chat_id записывается по from.id = telegram_id).
-- Пары устаревают и очищаются, чат_id переносится в telegram_settings.

CREATE TABLE IF NOT EXISTS telegram_pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  telegram_id BIGINT,
  chat_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_pairings_user_id_idx
  ON telegram_pairings (user_id);

-- Enable row level security
ALTER TABLE telegram_pairings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own pairings" ON telegram_pairings;
CREATE POLICY "Users can only access their own pairings"
  ON telegram_pairings
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own pairings" ON telegram_pairings;
CREATE POLICY "Users can insert their own pairings"
  ON telegram_pairings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own pairings" ON telegram_pairings;
CREATE POLICY "Users can update their own pairings"
  ON telegram_pairings
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own pairings" ON telegram_pairings;
CREATE POLICY "Users can delete their own pairings"
  ON telegram_pairings
  FOR DELETE
  USING (user_id = auth.uid());
