-- ================================================
-- ПОЛНЫЙ SETUP для Digital Birthday Reminder
-- Выполните ЭТОТ скрипт ОДИН раз в SQL Editor.
-- ================================================

-- 1. Расширение для функции uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Таблица public.users (профили пользователей)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email text,
    name text,
    full_name text,
    image text,
    avatar_url text,
    user_id text UNIQUE,
    token_identifier text NOT NULL UNIQUE,
    subscription text,
    credits text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS user_id_idx ON public.users(user_id);

-- 3. RLS для public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;
CREATE POLICY "Users can delete their own profile"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- 4. Таблица contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own contacts" ON contacts;
CREATE POLICY "Users can only access their own contacts"
  ON contacts
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
CREATE POLICY "Users can insert their own contacts"
  ON contacts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
CREATE POLICY "Users can update their own contacts"
  ON contacts
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
CREATE POLICY "Users can delete their own contacts"
  ON contacts
  FOR DELETE
  USING (user_id = auth.uid());

-- 5. Таблица telegram_settings
CREATE TABLE IF NOT EXISTS telegram_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  bot_token TEXT,
  notification_time TIME DEFAULT '09:00:00',
  days_before INTEGER DEFAULT 0,
  message_template TEXT DEFAULT 'Today is {{name}}''s birthday!',
  use_random_congratulations BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_telegram UNIQUE (user_id)
);

ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own telegram settings" ON telegram_settings;
CREATE POLICY "Users can only access their own telegram settings"
  ON telegram_settings
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own telegram settings" ON telegram_settings;
CREATE POLICY "Users can insert their own telegram settings"
  ON telegram_settings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own telegram settings" ON telegram_settings;
CREATE POLICY "Users can update their own telegram settings"
  ON telegram_settings
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own telegram settings" ON telegram_settings;
CREATE POLICY "Users can delete their own telegram settings"
  ON telegram_settings
  FOR DELETE
  USING (user_id = auth.uid());

-- 6. Колонка timezone (для telegram_settings)
ALTER TABLE telegram_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'GMT+3';

-- 7. Таблица congratulations_usage (пул показанных поздравлений)
CREATE TABLE IF NOT EXISTS congratulations_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  used_indexes INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE congratulations_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can only access their own congratulations usage"
  ON congratulations_usage
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can insert their own congratulations usage"
  ON congratulations_usage
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can update their own congratulations usage"
  ON congratulations_usage
  FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own congratulations usage" ON congratulations_usage;
CREATE POLICY "Users can delete their own congratulations usage"
  ON congratulations_usage
  FOR DELETE
  USING (user_id = auth.uid());

-- 8. Realtime (безопасно для повторного запуска)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts', 'telegram_settings']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
