"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Tables } from "@/types/supabase";
import { createClient } from "../../../supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { YearNavigationCalendar } from "@/components/ui/year-navigation-calendar";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Имя должно содержать минимум 2 символа.",
  }),
  birth_date: z.date().nullable(),
  notes: z.string().optional(),
});

function isValidDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/** Разбирает ручной ввод даты: "ДД.ММ.ГГГГ" или "ГГГГ-ММ-ДД". */
function parseDateInput(
  value: string,
): { year: number; month: number; day: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    return isValidDate(year, month, day) ? { year, month, day } : null;
  }

  match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return isValidDate(year, month, day) ? { year, month, day } : null;
  }

  return null;
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

/** Вставляет точки в ручной ввод даты: "0501" → "05.01", "05011990" → "05.01.1990". */
function applyDateMask(value: string): string {
  const trimmed = value.trim();
  // ISO-ввод ("ГГГГ-ММ-ДД") не трогаем.
  if (/^\d{4}-/.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  if (digits.length > 2) parts.push(digits.slice(2, 4));
  if (digits.length > 4) parts.push(digits.slice(4, 8));
  return parts.join(".");
}

interface ContactFormProps {
  userId: string;
  contact?: Tables<"contacts">;
}

export default function ContactForm({ userId, contact }: ContactFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Текст даты для ручного ввода (без привязки к часовому поясу).
  const birthDateParts = contact?.birth_date?.split("T")[0]?.split("-");
  const [dateInput, setDateInput] = useState(
    birthDateParts && birthDateParts.length === 3
      ? `${birthDateParts[2]}.${birthDateParts[1]}.${birthDateParts[0]}`
      : "",
  );

  // Initialize form with existing contact data if editing
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: contact?.name || "",
      birth_date: contact?.birth_date ? new Date(contact.birth_date) : null,
      notes: contact?.notes || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!values.birth_date) {
      form.setError("birth_date", {
        type: "manual",
        message: "Пожалуйста, выберите дату рождения.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Преобразуем дату в формат YYYY-MM-DD
      const formattedDate = new Date(values.birth_date)
        .toISOString()
        .split("T")[0];

      if (contact) {
        // Обновление существующего контакта
        const { error } = await supabase
          .from("contacts")
          .update({
            name: values.name,
            birth_date: formattedDate,
            notes: values.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contact.id)
          .eq("user_id", userId);

        if (error) {
          console.error("Error updating contact:", error);
          throw error;
        }
      } else {
        // Создание нового контакта
        const { error } = await supabase.from("contacts").insert({
          user_id: userId,
          name: values.name,
          birth_date: formattedDate,
          notes: values.notes,
        });

        if (error) {
          console.error("Error creating contact:", error);
          throw error;
        }
      }

      // После успешного сохранения
      router.push("/dashboard/contacts");
      router.refresh();
    } catch (error) {
      console.error("Error saving contact:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const onDateSelect = (date: Date | undefined) => {
    if (!date) return;
    // Устанавливаем дату в UTC на полдень, чтобы избежать проблем с DST.
    const utcDate = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
    );
    form.setValue("birth_date", utcDate, { shouldDirty: true });
    form.clearErrors("birth_date");
    setDateInput(
      formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    );
    // Закрываем календарь сразу после выбора даты
    setIsCalendarOpen(false);
  };

  const onDateInputChange = (raw: string) => {
    const masked = applyDateMask(raw);
    const parsed = parseDateInput(masked);

    if (parsed) {
      const now = new Date();
      const todayMs = Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const parsedMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day);

      if (parsed.year < 1900 || parsedMs > todayMs) {
        setDateInput(masked);
        form.setValue("birth_date", null, { shouldDirty: true });
        form.setError("birth_date", {
          type: "manual",
          message: "Дата должна быть в диапазоне с 1900 по сегодняшний день.",
        });
        return;
      }

      setDateInput(formatDateParts(parsed.year, parsed.month, parsed.day));
      const utcDate = new Date(
        Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0),
      );
      form.setValue("birth_date", utcDate, { shouldDirty: true });
      form.clearErrors("birth_date");
    } else {
      setDateInput(masked);
      form.setValue("birth_date", null, { shouldDirty: true });
      if (masked.trim()) {
        form.setError("birth_date", {
          type: "manual",
          message: "Введите дату в формате ДД.ММ.ГГГГ.",
        });
      } else {
        form.clearErrors("birth_date");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-card/80 p-6 rounded-xl border border-border/30 shadow-sm backdrop-blur-sm overflow-x-hidden">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 overflow-x-hidden"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Имя</FormLabel>
                <FormControl>
                  <Input placeholder="Иван Иванов" {...field} />
                </FormControl>
                <FormDescription>
                  Введите полное имя вашего контакта.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="birth_date"
            render={({ field }) => (
              <FormItem className="flex flex-col overflow-x-hidden">
                <FormLabel>Дата рождения</FormLabel>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <div className="flex w-[260px] max-w-full">
                        <Input
                          value={dateInput}
                          onChange={(e) => onDateInputChange(e.target.value)}
                          placeholder="ДД.ММ.ГГГГ"
                          className="rounded-r-none border-r-0 bg-card/90"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCalendarOpen(true)}
                          className="rounded-l-none border-border/50 bg-card/90 px-3 shadow-sm"
                          aria-label="Открыть календарь"
                        >
                          <CalendarIcon className="h-4 w-4 opacity-50" />
                        </Button>
                      </div>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 bg-card/95 border-border/50 backdrop-blur-sm shadow-lg max-h-[400px] overflow-y-auto overflow-x-hidden"
                    align="start"
                    sideOffset={5}
                  >
                    <div className="flex flex-col">
                      <div className="p-2 pb-0 flex justify-between items-center">
                        <div className="text-xs font-medium">Выберите дату</div>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => setIsCalendarOpen(false)}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 border-none text-xs px-2 py-0 h-6"
                        >
                          Готово
                        </Button>
                      </div>
                      <YearNavigationCalendar
                        mode="single"
                        selected={
                          field.value instanceof Date ? field.value : undefined
                        }
                        onSelect={(date) => onDateSelect(date)}
                        disabled={(date: Date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                        locale={ru}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Заметки (Необязательно)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Добавьте любую дополнительную информацию об этом контакте..."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Добавьте любые заметки или напоминания об этом контакте.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting} variant="default">
              {isSubmitting
                ? contact
                  ? "Обновление..."
                  : "Сохранение..."
                : contact
                  ? "Обновить контакт"
                  : "Сохранить контакт"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/contacts")}
              className="bg-card/80 text-foreground border-border/30 hover:bg-card"
            >
              Отмена
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
