export interface DetectedChat {
  chatId: string;
  title: string;
  type: string;
}

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

interface TelegramUpdate {
  update_id?: number;
  message?: { chat?: TelegramChat };
  edited_message?: { chat?: TelegramChat };
  channel_post?: { chat?: TelegramChat };
  my_chat_member?: { chat?: TelegramChat };
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
 * Определяет чаты (личные и группы), в которых состоит бот, через getUpdates.
 * Нужно, чтобы автоматически подставить chat_id группы в настройки.
 */
export async function detectBotChats(
  botToken: string,
): Promise<DetectedChat[]> {
  const seen = new Map<string, DetectedChat>();

  const collectChat = (chat: TelegramChat | undefined) => {
    if (!chat || typeof chat.id !== "number") return;
    const id = String(chat.id);
    const type = chat.type ?? "unknown";
    const name =
      chat.title ||
      [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
      chat.username ||
      "";
    const existing = seen.get(id);
    if (!existing) {
      seen.set(id, { chatId: id, title: name || `Chat ${id}`, type });
    } else if (name && existing.title.startsWith("Chat ")) {
      seen.set(id, { ...existing, title: name });
    }
  };

  const getUpdates = async (body: Record<string, unknown>) => {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    if (!data.ok) {
      throw new Error(data.description || "Telegram API error");
    }
    return data.result as TelegramUpdate[];
  };

  const updates = await getUpdates({
    timeout: 0,
    limit: 100,
    allowed_updates: [
      "message",
      "edited_message",
      "channel_post",
      "my_chat_member",
    ],
  });

  let maxUpdateId = 0;
  for (const update of updates) {
    maxUpdateId = Math.max(maxUpdateId, update.update_id ?? 0);
    if (update.message) collectChat(update.message.chat);
    if (update.edited_message) collectChat(update.edited_message.chat);
    if (update.channel_post) collectChat(update.channel_post.chat);
    if (update.my_chat_member) collectChat(update.my_chat_member.chat);
  }

  // Подтверждаем обработанные обновления, чтобы очередь не засорялась.
  if (maxUpdateId > 0) {
    await getUpdates({ timeout: 0, offset: maxUpdateId + 1 }).catch(() => {});
  }

  const chats = Array.from(seen.values());
  chats.sort((a, b) => {
    const aIsGroup = a.type === "private" ? 1 : 0;
    const bIsGroup = b.type === "private" ? 1 : 0;
    if (aIsGroup !== bIsGroup) return aIsGroup - bIsGroup;
    return a.title.localeCompare(b.title, "ru");
  });
  return chats;
}
