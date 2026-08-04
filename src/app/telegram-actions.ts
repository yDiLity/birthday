"use server";

import {
  detectBotChats,
  getBotInfo,
  sendTelegramMessage,
  type DetectedChat,
  type TelegramBotInfo,
} from "@/lib/telegram";
import { getTelegramBotToken } from "@/lib/env";
import { createAdminClient } from "../../supabase/admin";
import { createClient } from "../../supabase/server";

export interface DetectChatsResult {
  chats?: DetectedChat[];
  error?: string;
}

/**
 * Находит чаты (группы и личные), в которых состоит бот пользователя.
 * Токен берётся из формы, если он настоящий, либо из сохранённых настроек.
 */
export async function detectChatsAction(
  botToken?: string | null,
): Promise<DetectChatsResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Пользователь не авторизован." };
  }

  let token = botToken?.trim() ? botToken.trim() : null;
  if (token?.endsWith("…")) {
    token = null;
  }

  if (!token) {
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from("telegram_settings")
      .select("bot_token")
      .eq("user_id", user.id)
      .maybeSingle();

    token = settings?.bot_token ?? null;
  }

  if (!token) {
    return {
      error:
        "Не найден токен бота. Введите токен в поле ниже или сохраните настройки.",
    };
  }

  try {
    const chats = await detectBotChats(token);
    if (chats.length === 0) {
      return {
        error:
          "Чаты не найдены. Добавьте бота в группу и напишите в ней /start, затем повторите.",
      };
    }
    return { chats };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Ошибка при обращении к Telegram.",
    };
  }
}

/** Информация об общем боте приложения (имя пользователя для инструкций). */
export async function getCentralBotInfoAction(): Promise<TelegramBotInfo | null> {
  const token = getTelegramBotToken();
  if (!token) return null;
  return getBotInfo(token);
}

interface SendTelegramMessageResult {
  ok: boolean;
  error?: string;
}

/**
 * Отправляет сообщение через Telegram. Токен: переданный (свой бот) →
 * сохранённый в настройках → общий бот приложения из env.
 */
export async function sendTelegramMessageAction(
  chatId: string,
  text: string,
  botToken?: string | null,
): Promise<SendTelegramMessageResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Пользователь не авторизован." };
  }

  let token = botToken?.trim() ? botToken.trim() : null;
  if (token?.endsWith("…")) {
    token = null;
  }

  if (!token) {
    const admin = createAdminClient();
    const { data: settings } = await admin
      .from("telegram_settings")
      .select("bot_token")
      .eq("user_id", user.id)
      .maybeSingle();

    token = settings?.bot_token ?? getTelegramBotToken();
  }

  if (!token) {
    return {
      ok: false,
      error: "Не найден токен бота. Введите токен или сохраните настройки.",
    };
  }

  if (!chatId) {
    return { ok: false, error: "Укажите ID чата." };
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
