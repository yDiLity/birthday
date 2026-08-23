import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const RAW_PATH =
  "C:/Users/dmb25/AppData/Local/Temp/opencode/congrats-raw.txt";
const ENV_PATH =
  "C:/Users/dmb25/OneDrive/Рабочий стол/проект15/.env.local";

function loadEnvFile(path: string): Record<string, string> {
  const content = readFileSync(path, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

async function main() {
  // Разбор исходника: достаём все строки в кавычках, в порядке следования.
  const raw = readFileSync(RAW_PATH, "utf8");
  const matches = raw.match(/"[^"\r\n]+"/g) ?? [];
  const seen = new Set<string>();
  const texts: string[] = [];
  const duplicates: string[] = [];
  for (const match of matches) {
    const text = match.slice(1, -1).trim();
    if (!text) continue;
    if (seen.has(text)) {
      duplicates.push(text);
      continue;
    }
    seen.add(text);
    texts.push(text);
  }

  console.log(`Извлечено строк: ${matches.length}`);
  console.log(`Уникальных: ${texts.length}`);
  console.log(`Дубликатов пропущено: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log("Повторы:", Array.from(new Set(duplicates)).join(" | "));
  }

  const env = loadEnvFile(ENV_PATH);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Нет NEXT_PUBLIC_SUPABASE_URL или SERVICE_ROLE_KEY в .env.local");
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Текущее состояние таблицы.
  const { data: existing, error: selectError } = await supabase
    .from("congratulations")
    .select("user_id");
  if (selectError) throw selectError;
  const byUser = new Map<string, number>();
  for (const row of existing ?? []) {
    byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + 1);
  }
  console.log(
    "Сейчас в БД:",
    Array.from(byUser.entries())
      .map(([u, c]) => `${u.slice(0, 8)}…: ${c}`)
      .join(", "),
  );

  if (texts.length === 0) {
    throw new Error("Не извлечено ни одного поздравления — прерываю.");
  }

  let userIds = Array.from(byUser.keys());
  if (userIds.length === 0) {
    // Таблица пуста — берём единственного пользователя из users.
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id")
      .limit(2);
    if (usersError) throw usersError;
    userIds = (users ?? []).map((u) => u.id);
    if (userIds.length !== 1) {
      throw new Error(
        `Таблица поздравлений пуста, а пользователей в users: ${userIds.length} — уточните, кому заливать.`,
      );
    }
    console.log("Пул пуст, заливаю пользователю:", userIds[0].slice(0, 8));
  }
  if (userIds.length > 1) {
    throw new Error(
      "В таблице поздравления нескольких пользователей — вручную уточните, чей пул заменять.",
    );
  }
  const userId = userIds[0];
  // Замена: удаляем старый пул пользователя целиком.
  const { error: deleteError } = await supabase
    .from("congratulations")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;
  console.log(`Старых удалено: ${byUser.get(userId) ?? 0}`);

  // Заливаем новый пул пачками.
  for (let i = 0; i < texts.length; i += 200) {
    const batch = texts.slice(i, i + 200).map((text) => ({
      user_id: userId,
      text,
    }));
    const { error: insertError } = await supabase
      .from("congratulations")
      .insert(batch);
    if (insertError) throw insertError;
    console.log(`Залито ${Math.min(i + 200, texts.length)} / ${texts.length}`);
  }

  // Сбрасываем счётчик использованных, чтобы ротация началась заново.
  const { error: usageError } = await supabase
    .from("congratulations_usage")
    .update({ used_ids: [], updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (usageError && usageError.code !== "PGRST116") {
    console.error("Не сбросил used_ids:", usageError.message);
  }

  const { count } = await supabase
    .from("congratulations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  console.log(`Готово. Теперь в пуле пользователя ${userId.slice(0, 8)}…: ${count} поздравлений.`);
}

main().catch((error) => {
  console.error("ОШИБКА:", error);
  process.exit(1);
});
