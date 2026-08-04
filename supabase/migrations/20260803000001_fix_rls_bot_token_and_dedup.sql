-- 1) UPDATE-политики: добавить WITH CHECK, чтобы строки нельзя было переносить
--    на чужой user_id (пользователь мог обновить свою строку и «украсть» чужую).

DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
CREATE POLICY "Users can update their own contacts"
  ON contacts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own telegram settings" ON telegram_settings;
CREATE POLICY "Users can update their own telegram settings"
  ON telegram_settings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can update their own congratulations usage"
  ON congratulations_usage
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own congratulations" ON congratulations;
CREATE POLICY "Users can update their own congratulations"
  ON congratulations
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) bot_token не должен читаться из браузера. Отзываем column-level SELECT
--    у публичных ролей и отдаём маскированное значение через security definer.

REVOKE SELECT (bot_token) ON public.telegram_settings FROM anon;
REVOKE SELECT (bot_token) ON public.telegram_settings FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_telegram_settings()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  chat_id text,
  bot_token text,
  notification_time time,
  days_before integer,
  message_template text,
  use_random_congratulations boolean,
  is_active boolean,
  timezone text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    ts.id,
    ts.user_id,
    ts.chat_id,
    CASE
      WHEN ts.bot_token IS NULL OR ts.bot_token = '' THEN NULL
      ELSE left(ts.bot_token, 8) || '…'
    END AS bot_token,
    ts.notification_time,
    ts.days_before,
    ts.message_template,
    ts.use_random_congratulations,
    ts.is_active,
    ts.timezone,
    ts.created_at,
    ts.updated_at
  FROM public.telegram_settings AS ts
  WHERE ts.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_telegram_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_telegram_settings() TO authenticated;

-- 3) Лог отправленных уведомлений — защита от дублей при повторных запусках cron
--    (сервер пишет через service role, пользователи видят только свои записи).

CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  sent_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_contact_sent UNIQUE (contact_id, sent_date)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_date
  ON public.notification_log(user_id, sent_date);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification log" ON public.notification_log;
CREATE POLICY "Users can view their own notification log"
  ON public.notification_log
  FOR SELECT
  USING (user_id = auth.uid());
