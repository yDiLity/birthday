-- Add option to send random congratulations from the 650-text pool
-- instead of the fixed message template (Telegram notifications).
ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS use_random_congratulations BOOLEAN NOT NULL DEFAULT false;
