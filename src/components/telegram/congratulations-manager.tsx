"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2, Upload, Trash } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createClient } from "../../../supabase/client";
import * as XLSX from "xlsx";
import JSZip from "jszip";

interface CongratulationsManagerProps {
  userId: string;
  initialRows: Array<{ id: string; text: string }>;
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/** Извлекает тексты из блока одного абзаца word/document.xml. */
const extractTextFromBlock = (block: string): string => {
  const withBreaks = block.replace(/<w:br\b[^>]*\/>/g, "\n");
  const parts: string[] = [];
  const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let match = tRe.exec(withBreaks);
  while (match) {
    parts.push(decodeXmlEntities(match[1]));
    match = tRe.exec(withBreaks);
  }
  return parts.join("").trim();
};

/** Word: каждый абзац (красная строка) становится отдельным поздравлением. */
const parseDocx = async (buffer: ArrayBuffer): Promise<string[]> => {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("Файл не похож на документ Word (.docx)");
  const xml = await doc.async("string");
  const texts: string[] = [];
  const openRe = /<w:p\b[^>]*>/g;
  const closeTag = "</w:p>";
  let match = openRe.exec(xml);
  while (match) {
    const start = match.index + match[0].length;
    const end = xml.indexOf(closeTag, start);
    if (end === -1) break;
    const text = extractTextFromBlock(xml.slice(start, end));
    if (text) texts.push(text);
    openRe.lastIndex = end + closeTag.length;
    match = openRe.exec(xml);
  }
  return texts;
};

/** Excel: каждая непустая ячейка (обычно одна колонка) — отдельное поздравление. */
const parseXlsx = (buffer: ArrayBuffer): string[] => {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });
  const texts: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell === "string" && cell.trim()) {
        texts.push(cell.trim());
      } else if (typeof cell === "number" && !Number.isNaN(cell)) {
        texts.push(String(cell));
      }
    }
  }
  return texts;
};

export default function CongratulationsManager({
  userId,
  initialRows,
}: CongratulationsManagerProps) {
  const supabase = createClient();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.text.toLowerCase().includes(q));
  }, [rows, search]);

  const startEdit = (row: { id: string; text: string }) => {
    setEditingId(row.id);
    setEditText(row.text);
    setError(null);
  };

  const saveEdit = async (id: string) => {
    const text = editText.trim();
    if (!text) {
      setError("Текст не может быть пустым.");
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("congratulations")
        .update({ text, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, text } : row)),
      );
      setEditingId(null);
    } catch (err) {
      console.error("Error saving congratulation:", err);
      setError("Не удалось сохранить изменение.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (id: string) => {
    if (!window.confirm("Удалить это поздравление из пула?")) return;
    setSavingId(id);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("congratulations")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      console.error("Error deleting congratulation:", err);
      setError("Не удалось удалить поздравление.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm(`Удалить все ${rows.length} поздравлений? Это действие нельзя отменить.`)) return;
    setDeletingAll(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("congratulations")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      setRows([]);
    } catch (err) {
      console.error("Error deleting all congratulations:", err);
      setError("Не удалось удалить поздравления.");
    } finally {
      setDeletingAll(false);
    }
  };

  const fetchExistingTexts = async (texts: string[]) => {
    const found: Array<{ text: string }> = [];
    for (const batch of chunk(texts, 900)) {
      const { data, error } = await supabase
        .from("congratulations")
        .select("text")
        .eq("user_id", userId)
        .in("text", batch);
      if (error) throw error;
      if (data) found.push(...data);
    }
    return found;
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportMessage(null);
    setImportError(null);
    try {
      const buffer = await file.arrayBuffer();
      const lower = file.name.toLowerCase();
      let rawTexts: string[];
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        rawTexts = parseXlsx(buffer);
      } else if (lower.endsWith(".docx")) {
        rawTexts = await parseDocx(buffer);
      } else {
        throw new Error("Поддерживаются файлы: .xlsx, .xls, .docx");
      }

      const seen = new Set<string>();
      const cleaned: string[] = [];
      for (const text of rawTexts) {
        const trimmed = text.trim();
        if (!trimmed) continue;
        if (trimmed.length > 4096) continue;
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);
        cleaned.push(trimmed);
      }

      if (cleaned.length === 0) {
        setImportError("В файле не найдено текстов для импорта.");
        return;
      }

      const existing = new Set(
        (await fetchExistingTexts(cleaned)).map((row) => row.text),
      );
      const fresh = cleaned.filter((text) => !existing.has(text));

      let added = 0;
      if (fresh.length > 0) {
        const inserted: Array<{ id: string; text: string }> = [];
        for (const batch of chunk(fresh, 900)) {
          const { data, error } = await supabase
            .from("congratulations")
            .upsert(
              batch.map((text) => ({ user_id: userId, text })),
              { onConflict: "user_id,text" },
            )
            .select("id, text");
          if (error) throw error;
          if (data) inserted.push(...data);
        }
        added = inserted.length;
        setRows((prev) => {
          const known = new Set(prev.map((row) => row.text));
          return [
            ...prev,
            ...inserted.filter((row) => !known.has(row.text)),
          ];
        });
      }

      const skipped = cleaned.length - added;
      setImportMessage(
        skipped > 0
          ? `Импортировано: ${added}. Пропущено дубликатов: ${skipped}.`
          : `Импортировано: ${added}.`,
      );
    } catch (err) {
      console.error("Import error:", err);
      setImportError(
        err instanceof Error
          ? err.message
          : "Не удалось импортировать файл.",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск по тексту поздравлений..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Импорт..." : "Импорт"}
          </Button>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Всего: {rows.length}
          </span>
          {rows.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void deleteAll()}
              disabled={deletingAll}
            >
              <Trash className="mr-2 h-4 w-4" />
              {deletingAll ? "Удаление..." : "Удалить все"}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Импорт: Excel (.xlsx, .xls) — каждая ячейка это одно поздравление. Word
        (.docx) — каждый абзац (красная строка) становится отдельным
        поздравлением. Дубликаты пропускаются.
      </p>

      {importError && (
        <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>
      )}
      {importMessage && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {importMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rows.length === 0
            ? "Поздравления пока не загружены."
            : "Ничего не найдено по запросу."}
        </p>
      ) : (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="rounded-lg border border-border/30 bg-card/60 p-4"
            >
              {editingId === row.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(null)}
                      disabled={savingId === row.id}
                    >
                      Отмена
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveEdit(row.id)}
                      disabled={savingId === row.id}
                    >
                      {savingId === row.id ? "Сохранение..." : "Сохранить"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed">{row.text}</p>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(row)}
                    >
                      Изменить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void deleteRow(row.id)}
                      disabled={savingId === row.id}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
