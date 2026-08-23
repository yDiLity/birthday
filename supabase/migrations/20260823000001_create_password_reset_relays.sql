-- Релеи одноразовых PKCE-кодов для кросс-девайсного сброса пароля.
-- Ссылку из письма открывают на телефоне: страница /auth/callback не может
-- обменять код на сессию там (PKCE-verifier остался в браузере компьютера),
-- поэтому телефон просто пересылает код сюда под случайным relay_id,
-- а компьютер забирает его и обменивает на сессию сам.
create table if not exists public.password_reset_relays (
  relay_id text primary key,
  code text,
  created_at timestamptz not null default now()
);

alter table public.password_reset_relays enable row level security;

-- Политик нет намеренно: таблица доступна только через service role
-- (серверные экшены и API-роуты). Клиенты в браузере её не видят.
