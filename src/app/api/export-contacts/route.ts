import { NextResponse } from "next/server";
import { createClient } from "../../../../supabase/server";
import ExcelJS from "exceljs";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "xlsx";

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("name, birth_date, notes")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (format === "csv") {
    return exportCsv(contacts ?? []);
  }

  return exportXlsx(contacts ?? []);
}

function exportCsv(
  contacts: Array<{ name: string; birth_date: string; notes: string | null }>,
) {
  const header = "Имя,Дата рождения,Заметки\n";
  const rows = contacts
    .map((c) => {
      const date = new Date(c.birth_date).toLocaleDateString("ru-RU");
      const notes = (c.notes ?? "").replace(/"/g, '""');
      return `"${c.name}","${date}","${notes}"`;
    })
    .join("\n");

  const bom = "\uFEFF"; // UTF-8 BOM for Excel
  return new NextResponse(bom + header + rows, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

async function exportXlsx(
  contacts: Array<{ name: string; birth_date: string; notes: string | null }>,
) {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Контакты");

  sheet.columns = [
    { header: "Имя", key: "name", width: 30 },
    { header: "Дата рождения", key: "birth_date", width: 18 },
    { header: "Возраст", key: "age", width: 10 },
    { header: "Дней до ДР", key: "days_until", width: 14 },
    { header: "Заметки", key: "notes", width: 40 },
  ];

  const today = new Date();

  for (const contact of contacts) {
    const birthDate = new Date(contact.birth_date);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const adjustedAge =
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1
        : age;

    const dayMs = 86_400_000;
    const thisYearIdx =
      Date.UTC(
        today.getFullYear(),
        birthDate.getMonth(),
        birthDate.getDate(),
      ) / dayMs;
    const todayIdx =
      Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ) / dayMs;
    let daysUntil = thisYearIdx - todayIdx;
    if (daysUntil < 0) {
      const nextYearIdx =
        Date.UTC(
          today.getFullYear() + 1,
          birthDate.getMonth(),
          birthDate.getDate(),
        ) / dayMs;
      daysUntil = nextYearIdx - todayIdx;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheet.addRow({
      name: contact.name,
      birth_date: birthDate.toLocaleDateString("ru-RU"),
      age: adjustedAge,
      days_until: daysUntil,
      notes: contact.notes ?? "",
    } as any);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await (workbook.xlsx as any).writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="contacts_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
