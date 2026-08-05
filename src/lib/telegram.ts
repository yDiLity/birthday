export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Обратное преобразование HTML-сущностей для отправки обычным текстом. */
function decodeHtml(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

interface TelegramChat {
  id?: number;
  type?: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: { chat?: TelegramChat };
  my_chat_member?: { chat?: TelegramChat; from?: TelegramUser };
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string,
) {
  const doSend = async (payload: Record<string, unknown>) => {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    const data = await response.json();
    return { ok: response.ok, data };
  };

  try {
    const first = await doSend({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    });

    if (first.ok) {
      return { success: true };
    }

    const description: string =
      typeof first.data?.description === "string"
        ? first.data.description
        : "";

    // Битый HTML в тексте (например, из импортированных поздравлений) —
    // повторяем отправку без parse_mode как обычный текст.
    if (/parse|HTML/i.test(description)) {
      const fallback = await doSend({
        chat_id: chatId,
        text: decodeHtml(message),
      });
      if (fallback.ok) {
        return { success: true };
      }
      console.error("Telegram API error:", fallback.data);
      return { success: false, error: fallback.data };
    }

    console.error("Telegram API error:", first.data);
    return { success: false, error: first.data };
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return { success: false, error };
  }
}

export interface TelegramBotInfo {
  username?: string;
  name?: string;
}

export async function getBotInfo(
  botToken: string,
): Promise<TelegramBotInfo | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const data = await response.json();
    if (!data.ok) return null;
    return {
      username: data.result?.username,
      name: data.result?.first_name,
    };
  } catch {
    return null;
  }
}

/**
 * Читает обновления бота БЕЗ подтверждения offset. Не подтверждая offset, мы
 * не вытесняем из очереди обновления других пользователей общего бота.
 */
export async function getBotUpdates(botToken: string): Promise<TelegramUpdate[]> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeout: 0,
        limit: 100,
        allowed_updates: [
          "message",
          "edited_message",
          "channel_post",
          "my_chat_member",
        ],
      }),
    },
  );
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || "Telegram API error");
  }
  return data.result as TelegramUpdate[];
}

/** Подтверждает обработанные обновления (убирает их из очереди). */
export async function confirmBotUpdates(
  botToken: string,
  offset: number,
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeout: 0, offset }),
    },
  );
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || "Telegram API error");
  }
}
