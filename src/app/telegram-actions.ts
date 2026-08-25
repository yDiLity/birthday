"use server";

import {
  getBotInfo,
  getBotUpdates,
  sendTelegramMessage,
  type TelegramBotInfo,
  type TelegramUpdate,
} from "@/lib/telegram";
import { getTelegramBotToken } from "@/lib/env";
import { createAdminClient } from "../../supabase/admin";
import { randomBytes } from "node:crypto";
import { createClient } from "../../supabase/server";

/** Время жизни pairing-записи (30 минут). */
const PAIRING_TTL_MS = 30 * 60 * 1000;

/** Удаляет пары старше TTL. */
async function cleanupStalePairings(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - PAIRING_TTL_MS).toISOString();
  await admin
    .from("telegram_pairings")
    .delete()
    .lt("created_at", cutoff)
    .is("chat_id", null);
}

/** Информация об общем боте приложения (имя пользователя для инструкций). */
export async function getCentralBotInfoAction(): Promise<TelegramBotInfo | null> {
  const token = getTelegramBotToken();
  if (!token) return null;
  return getBotInfo(token);
}

interface StartBotLinkingResult {
  ok: boolean;
  error?: string;
  code?: string;
  url?: string;
  botUsername?: string;
}

/**
 * Начинает флоу «подключить без токена»: генерирует код привязки и ссылку
 * t.me/<bot>?start=<code>. Человек открывает ссылку и нажимает Start в личке.
 */
export async function startBotLinkingAction(): Promise<StartBotLinkingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Пользователь не авторизован." };
  }

  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "Общий бот приложения не настроен на сервере." };
  }

  const bot = await getBotInfo(token);
  const username = bot?.username;
  if (!username) {
    return { ok: false, error: "Не удалось получить username общего бота." };
  }

  const code = `bind_${randomBytes(8).toString("hex")}`;

  const admin = createAdminClient();

  // Удаляем старые pairing'и пользователя и протухшие записи
  await cleanupStalePairings(admin);

  const { error: deleteError } = await admin
    .from("telegram_pairings")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  const { error: insertError } = await admin
    .from("telegram_pairings")
    .insert({ user_id: user.id, code });
  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return {
    ok: true,
    code,
    botUsername: username,
    url: `https://t.me/${username}?start=${code}`,
  };
}

type LinkStatus = "waiting_start" | "waiting_group_message" | "done" | "expired";

interface CheckBotLinkingResult {
  ok: boolean;
  status?: LinkStatus;
  chatId?: string;
  error?: string;
}

/**
 * Проверяет статус привязки: найден ли telegram_id по коду из /start и найден
 * ли chat_id группы, где писал привязанный пользователь.
 *
 * Важно: НЕ подтверждаем offset в getUpdates, чтобы не вытеснять обновления
 * других пользователей общего бота. Подтверждение происходит только для
 * обновлений, однозначно относящихся к текущему пользователю.
 */
export async function checkBotLinkingAction(): Promise<CheckBotLinkingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Пользователь не авторизован." };
  }

  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, error: "Общий бот приложения не настроен на сервере." };
  }

  const admin = createAdminClient();

  // Очищаем протухшие pairing'и перед поиском
  await cleanupStalePairings(admin);

  const { data: pairing, error: pairingError } = await admin
    .from("telegram_pairings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pairingError) {
    return { ok: false, error: pairingError.message };
  }
  if (!pairing) {
    return { ok: false, error: "Сначала нажмите «Подключить бота»." };
  }

  // Проверяем, не истёк ли pairing
  const pairingAge = Date.now() - new Date(pairing.created_at).getTime();
  if (pairingAge > PAIRING_TTL_MS && !pairing.chat_id) {
    return {
      ok: true,
      status: "expired",
      error: "Срок действия подключения истёк. Нажмите «Подключить бота» заново.",
    };
  }

  // Уже привязан — возвращаем chat_id
  if (pairing.chat_id) {
    return { ok: true, status: "done", chatId: pairing.chat_id };
  }

  let updates: TelegramUpdate[];
  try {
    updates = await getBotUpdates(token);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Ошибка при обращении к Telegram.",
    };
  }

  let telegramId = pairing.telegram_id;
  let foundChatId: string | null = null;
  let maxOwnUpdateId = 0;

  for (const update of updates) {
    const message = update.message ?? update.edited_message;

    // Ищем сообщение с кодом привязки в личном чате
    if (
      !telegramId &&
      typeof message?.from?.id === "number" &&
      message.chat?.type === "private" &&
      typeof message.text === "string" &&
      message.text.includes(pairing.code)
    ) {
      telegramId = message.from.id;
      maxOwnUpdateId = Math.max(maxOwnUpdateId, update.update_id ?? 0);
    }

    // Ищем сообщение от привязанного пользователя в группе
    if (
      typeof message?.from?.id === "number" &&
      message.from.id === telegramId &&
      (message.chat?.type === "group" || message.chat?.type === "supergroup")
    ) {
      if (typeof message.chat.id === "number" && !foundChatId) {
        foundChatId = String(message.chat.id);
      }
      maxOwnUpdateId = Math.max(maxOwnUpdateId, update.update_id ?? 0);
    }

    // Добавление бота в группу тоже даёт chat.id группы
    const member = update.my_chat_member;
    if (
      !foundChatId &&
      typeof member?.from?.id === "number" &&
      member.from.id === telegramId &&
      (member.chat?.type === "group" || member.chat?.type === "supergroup") &&
      typeof member.chat.id === "number"
    ) {
      foundChatId = String(member.chat.id);
      maxOwnUpdateId = Math.max(maxOwnUpdateId, update.update_id ?? 0);
    }
  }

  // Сохраняем найденные данные
  if (telegramId !== pairing.telegram_id || foundChatId) {
    const updatePayload: {
      telegram_id?: number;
      chat_id?: string;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };
    if (telegramId !== pairing.telegram_id) {
      updatePayload.telegram_id = telegramId;
    }
    if (foundChatId) {
      updatePayload.chat_id = foundChatId;
    }

    const { error: updateError } = await admin
      .from("telegram_pairings")
      .update(updatePayload)
      .eq("id", pairing.id);
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
  }

  // Не подтверждаем offset — чтобы не вытеснять обновления других пользователей
  // общего бота. Обновления с кодом привязки останутся в очереди, но это
  // безопасно: при повторном checkBotLinkingAction они будут проигнорированы,
  // т.к. telegram_id уже найден.

  if (foundChatId) {
    return { ok: true, status: "done", chatId: foundChatId };
  }
  if (telegramId) {
    return { ok: true, status: "waiting_group_message" };
  }
  return { ok: true, status: "waiting_start" };
}

interface SendTelegramMessageResult {
  ok: boolean;
  error?: string;
}

/**
 * Отправляет сообщение через общего бота приложения (токен из env).
 */
export async function sendTelegramMessageAction(
  chatId: string,
  text: string,
): Promise<SendTelegramMessageResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Пользователь не авторизован." };
  }

  const token = getTelegramBotToken();
  if (!token) {
    return {
      ok: false,
      error: "Общий бот приложения не настроен на сервере.",
    };
  }

  if (!chatId) {
    return { ok: false, error: "Укажите ID чата." };
  }

  // Проверяем, что chatId соответствует настроенному пользователю чату
  const supabaseAdmin = createAdminClient();
  const { data: settings } = await supabaseAdmin
    .from("telegram_settings")
    .select("chat_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!settings || settings.chat_id !== chatId) {
    return {
      ok: false,
      error: "Нельзя отправлять сообщения в чат, не привязанный к вашему аккаунту.",
    };
  }

  const result = await sendTelegramMessage(token, chatId, text);
  if (result.success) {
    return { ok: true };
  }

  const error = result.error as
    | {
        description?: string;
        message?: string;
      }
    | Error;
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: error?.description ?? error?.message ?? "Ошибка отправки сообщения.",
  };
}
