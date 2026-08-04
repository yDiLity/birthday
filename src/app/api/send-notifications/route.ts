import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getTelegramBotToken } from "@/lib/env";
import { buildSeedRows } from "@/lib/congratulations";
import { getRateLimit } from "@/lib/rate-limit";
import { escapeHtml, sendTelegramMessage } from "@/lib/telegram";
import type { Database } from "@/types/supabase";
import { NextResponse } from "next/server";

// Add this line to explicitly set the allowed methods
export const dynamic = "force-dynamic";

type Contact = Pick<
  Database["public"]["Tables"]["contacts"]["Row"],
  "id" | "name" | "birth_date" | "notes"
>;

function formatBirthdayMessage(
  template: string,
  contact: Contact,
  daysUntilBirthday: number,
) {
  let message = template;
  message = message.replace(/{{name}}/g, escapeHtml(contact.name));
  message = message.replace(/{{days}}/g, daysUntilBirthday.toString());
  message = message.replace(/{{notes}}/g, escapeHtml(contact.notes || ""));
  return message;
}

/** Разбор часового пояса вида "GMT+3", "GMT-5", "GMT+3:30" → смещение в минутах. */
function getOffsetMinutes(timezone: string | null | undefined): number {
  if (!timezone) return 0;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/i.exec(timezone.trim());
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes);
}

interface TzNow {
  year: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
}

/** Текущее время в заданном часовом поясе. */
function nowInTimezone(offsetMinutes: number): TzNow {
  const now = new Date();
  const utcMs =
    now.getTime() + now.getTimezoneOffset() * 60000 + offsetMinutes * 60000;
  const d = new Date(utcMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
  };
}

/** Число дней до дня рождения (0 = сегодня) в локальном времени пользователя. */
function daysUntilBirthday(now: TzNow, birthDateStr: string): number {
  const birth = new Date(birthDateStr);
  const todayStart = Date.UTC(now.year, now.month, now.date);
  let candidate = new Date(
    Date.UTC(now.year, birth.getUTCMonth(), birth.getUTCDate()),
  );
  let diff = Math.round((candidate.getTime() - todayStart) / 86400000);
  if (diff < 0) {
    candidate = new Date(
      Date.UTC(now.year + 1, birth.getUTCMonth(), birth.getUTCDate()),
    );
    diff = Math.round((candidate.getTime() - todayStart) / 86400000);
  }
  return diff;
}

function formatSentDate(now: TzNow): string {
  const month = String(now.month + 1).padStart(2, "0");
  const date = String(now.date).padStart(2, "0");
  return `${now.year}-${month}-${date}`;
}

/** "09:00:00" или "09:00" → минуты с начала суток. */
function parseNotificationTime(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

async function getRandomCongratulation(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  try {
    let { data: rows } = await supabase
      .from("congratulations")
      .select("id, text")
      .eq("user_id", userId);

    if (!rows || rows.length === 0) {
      await supabase.from("congratulations").upsert(buildSeedRows(userId), {
        onConflict: "user_id,text",
      });
      ({ data: rows } = await supabase
        .from("congratulations")
        .select("id, text")
        .eq("user_id", userId));
    }

    const { data: usage } = await supabase
      .from("congratulations_usage")
      .select("used_ids")
      .eq("user_id", userId)
      .maybeSingle();

    const used: string[] = usage?.used_ids ?? [];
    const usedSet = new Set(used);
    const available = (rows ?? []).filter((row) => !usedSet.has(row.id));

    let pick: { id: string; text: string } | undefined;
    let nextUsed: string[];

    if (available.length === 0) {
      const all = rows ?? [];
      pick = all[Math.floor(Math.random() * all.length)];
      nextUsed = pick ? [pick.id] : [];
    } else {
      pick = available[Math.floor(Math.random() * available.length)];
      nextUsed = [...used, pick.id];
    }

    if (!pick) {
      return null;
    }

    const { error: upsertError } = await supabase
      .from("congratulations_usage")
      .upsert(
        {
          user_id: userId,
          used_ids: nextUsed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error("Error saving congratulations usage:", upsertError);
      return null;
    }

    return pick.text;
  } catch (err) {
    console.error("Error picking random congratulation:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const serviceRoleKey = getSupabaseServiceRoleKey();

    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error: "Missing service role key",
        },
        { status: 500 },
      );
    }

    const rateLimit = getRateLimit();
    if (rateLimit) {
      const forwardedFor = req.headers.get("x-forwarded-for");
      const identifier =
        forwardedFor?.split(",")[0]?.trim() || "send-notifications";
      const { success, limit, remaining, reset } =
        await rateLimit.limit(identifier);

      if (!success) {
        return NextResponse.json(
          { error: "Too Many Requests" },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          },
        );
      }
    }

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = req.headers.get("x-supabase-url");

    // Check if auth header exists and matches
    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ") ||
      authHeader.split(" ")[1] !== serviceRoleKey ||
      supabaseUrl !== process.env.NEXT_PUBLIC_SUPABASE_URL
    ) {
      return NextResponse.json(
        {
          error: "Invalid API key",
          details: "Authentication failed. Please check your credentials.",
        },
        { status: 401 },
      );
    }

    // Get force parameter from URL
    const url = new URL(req.url);
    const forceCheck = url.searchParams.get("force") === "true";

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey!,
    );

    const { data: telegramSettings, error: settingsError } = await supabase
      .from("telegram_settings")
      .select(
        "user_id, chat_id, bot_token, message_template, days_before, notification_time, timezone, use_random_congratulations",
      )
      .eq("is_active", true);

    if (settingsError) {
      console.error("Error fetching telegram settings:", settingsError);
      return NextResponse.json(
        { error: settingsError.message },
        { status: 500 },
      );
    }

    if (!telegramSettings?.length) {
      return NextResponse.json({
        message: "No active telegram settings found",
        success: true,
      });
    }

    let notificationsSent = false;
    let birthdaysFound = false;
    let alreadySent = 0;

    // Общий бот приложения, если задан. Иначе — свой бот каждого пользователя.
    const centralBotToken = getTelegramBotToken();

    for (const settings of telegramSettings) {
      const botToken = centralBotToken ?? settings.bot_token;
      if (!botToken) continue;

      const now = nowInTimezone(getOffsetMinutes(settings.timezone));
      const todayStr = formatSentDate(now);
      const currentMinutes = now.hours * 60 + now.minutes;
      const notificationMinutes = parseNotificationTime(
        settings.notification_time,
      );

      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, name, birth_date, notes")
        .eq("user_id", settings.user_id);

      if (contactsError) {
        console.error("Error fetching contacts:", contactsError);
        continue;
      }

      for (const contact of contacts) {
        const daysUntil = daysUntilBirthday(now, contact.birth_date);
        const isReminderDay =
          daysUntil === 0 ||
          (settings.days_before != null &&
            settings.days_before > 0 &&
            daysUntil === settings.days_before);

        if (!isReminderDay) {
          continue;
        }

        birthdaysFound = true;

        // Не отправляем раньше заданного времени уведомления (если задано).
        if (
          !forceCheck &&
          notificationMinutes !== null &&
          currentMinutes < notificationMinutes
        ) {
          console.log(
            `Skipping ${contact.name}: current ${currentMinutes} < notification time ${notificationMinutes}`,
          );
          continue;
        }

        // Защита от дублей при повторных запусках cron.
        const { data: existing } = await supabase
          .from("notification_log")
          .select("id")
          .eq("contact_id", contact.id)
          .eq("sent_date", todayStr)
          .maybeSingle();

        if (existing) {
          alreadySent += 1;
          console.log(`Notification for ${contact.name} already sent today`);
          continue;
        }

        let message: string | null = null;

        if (settings.use_random_congratulations) {
          message = await getRandomCongratulation(supabase, settings.user_id);
          if (!message) {
            message = formatBirthdayMessage(
              settings.message_template ?? "",
              contact,
              daysUntil,
            );
          }
        } else {
          message = formatBirthdayMessage(
            settings.message_template ?? "",
            contact,
            daysUntil,
          );
        }

        const result = await sendTelegramMessage(
          botToken,
          settings.chat_id,
          message,
        );

        if (result.success) {
          notificationsSent = true;
          await supabase.from("notification_log").insert({
            user_id: settings.user_id,
            contact_id: contact.id,
            sent_date: todayStr,
          });
          console.log(`Birthday notification sent for ${contact.name}`);
        } else {
          console.error(
            `Failed to send notification for ${contact.name}:`,
            result.error,
          );
        }
      }
    }

    const summary = [];
    if (birthdaysFound) {
      summary.push(
        notificationsSent
          ? "Birthday notifications sent!"
          : "Birthdays found but notifications were not sent",
      );
    } else {
      summary.push("No birthdays today");
    }
    if (alreadySent > 0) {
      summary.push(`${alreadySent} already sent`);
    }

    return NextResponse.json({
      message: summary.join(". "),
      success: true,
      birthdaysFound,
      notificationsSent,
      alreadySent,
    });
  } catch (error) {
    console.error("Detailed error in birthday notifications:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

// Optionally, add an OPTIONS handler to properly handle CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-supabase-url",
    },
  });
}
