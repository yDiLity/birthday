"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { createClient } from "../../../supabase/client";

interface CongratulationsManagerProps {
  userId: string;
  initialRows: Array<{ id: string; text: string }>;
}

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
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Всего: {rows.length}
        </span>
      </div>

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
        <ul className="space-y-2">
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
