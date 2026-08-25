import { NextResponse } from "next/server";
import { createClient } from "../../../../supabase/server";

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatICSDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}${month}${day}`;
}

function getUid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}@birthday-reminder.app`;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const years = Number.parseInt(url.searchParams.get("years") ?? "5", 10);
  const now = new Date();

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("name, birth_date")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Birthday Reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Дни рождения",
  ];

  for (const contact of contacts ?? []) {
    const birth = new Date(contact.birth_date);
    const birthMonth = birth.getUTCMonth();
    const birthDay = birth.getUTCDate();

    for (let y = 0; y < years; y++) {
      const year = now.getFullYear() + y;
      const eventDate = new Date(Date.UTC(year, birthMonth, birthDay));

      // Skip past dates for current year
      if (y === 0 && eventDate < now) continue;

      const age = year - birth.getUTCFullYear();
      const dateStr = formatICSDate(contact.birth_date);
      const eventDateStr = formatICSDate(eventDate.toISOString());

      lines.push("BEGIN:VEVENT");
      lines.push(`DTSTART;VALUE=DATE:${eventDateStr}`);
      lines.push(`DTEND;VALUE=DATE:${eventDateStr}`);
      lines.push(`RRULE:FREQ=YEARLY`);
      lines.push(`SUMMARY:🎂 ${escapeICS(contact.name)} — ${age} лет`);
      lines.push(
        `DESCRIPTION:День рождения ${escapeICS(contact.name)}\\nИсполняется ${age} лет`,
      );
      lines.push(`UID:${getUid()}`);
      lines.push(`CATEGORIES:Дни рождения`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  const icsContent = lines.join("\r\n");

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="birthdays_${new Date().toISOString().slice(0, 10)}.ics"`,
    },
  });
}
