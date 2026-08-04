# AGENTS.md — Birthday Reminder (проект15)

## Общение
- Отвечай и рассуждай на русском всегда.
- Git-коммиты, push и создание документации — только по прямой команде пользователя.
- Не открывай дополнительные окна терминала, используй текущее. Dev-сервер запущен на порту 3000 и не требует перезапуска.
- Если не можешь исправить ошибку за две попытки: прекрати, проведи детальный анализ, предложи альтернативы.

## Проект
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase. Никаких `.js`-файлов — только TypeScript.
- Telegram-уведомления о днях рождения.
- Прод: `https://birthday-reminder-kappa-umber.vercel.app` (не менять на временные деплой-URL).
- Git: ветка `main`, remote `https://github.com/yDiLity/birthday.git`.

## Команды
- Проверка типов: `npx tsc --noEmit`
- Сборка: `npm run build`
- Запуск скриптов: `npx tsx <файл>`

## Git identity (важно)
- Глобально git identity НЕ задана. Коммитить только так:
  `git -c user.name="yDiLity" -c user.email="yDiLity@users.noreply.github.com" commit -m "..."`

## Архитектура
- Уведомления: `src/app/api/send-notifications/route.ts` — POST (Bearer в headers) ИЛИ GET `?cron_secret=`.
- Триггеры уведомлений: UptimeRobot (каждые 5 мин, GET с cron_secret) — основной; `.github/workflows/cron.yml` — резервный (schedule GitHub Actions ненадёжен — может молча не запускаться).
- Vercel Hobby: почасовой `vercel.json` cron недоступен.
- `.env.local` — реальные ключи (не коммитить). GitHub Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Vercel env: `CRON_SECRET` (значение уже в Vercel и UptimeRobot).
- Supabase Free замораживается после ~7 дней без запросов — частые пинги UptimeRobot держат БД активной.

## БД (Supabase)
- Таблицы: `contacts`, `telegram_settings`, `congratulations` (scope по `user_id`, UNIQUE(user_id, text)), `congratulations_usage.used_ids`, `notification_log` (дедупликация по contact_id + sent_date).
- RLS: пользователи видят/меняют только свои данные. Удаление поздравления — только у своего `user_id` (у каждого пользователя свой пул).
- Токен бота возвращается из БД замаскированным (`get_my_telegram_settings`, маска заканчивается на "…").

## UI
- Настройки Telegram: `src/components/telegram/telegram-settings-form.tsx` (watch-поля для реактивных disabled, импорт `X` для списка чатов, supergroup-метка).
- Поздравления: `src/components/telegram/congratulations-manager.tsx` — поиск/правка/удаление + импорт (.xlsx/.xls через `xlsx`, .docx через `jszip`, абзац = одно поздравление).
- Серверные действия Telegram: `src/app/telegram-actions.ts`, хелперы: `src/lib/telegram.ts`.

## Деплой
- Push в `main` триггерит Vercel. Статус проверять: `curl -s https://api.github.com/repos/yDiLity/birthday/commits/<sha>/status`.
- После деплоя проверять: `curl https://birthday-reminder-kappa-umber.vercel.app/api/send-notifications` (без секрета должен вернуть 401).
