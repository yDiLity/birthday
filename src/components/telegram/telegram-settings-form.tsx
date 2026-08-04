"use client";

// import { zodResolver } from "@hookform/resolvers/zod";
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
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { InfoIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  detectChatsAction,
  getCentralBotInfoAction,
  sendTelegramMessageAction,
} from "@/app/telegram-actions";
import type { DetectedChat, TelegramBotInfo } from "@/lib/telegram";
import CongratulationsManager from "@/components/telegram/congratulations-manager";

const formSchema = z.object({
  chat_id: z.string().min(1, {
    message: "Chat ID is required.",
  }),
  bot_token: z.string().optional().nullable(), // Change this line to allow null values
  notification_time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "Please enter a valid time in 24-hour format (HH:MM).",
  }),
  timezone: z.string(),
  days_before: z.coerce.number().int().min(0).max(30),
  message_template: z.string().min(1, {
    message: "Message template is required.",
  }),
  use_random_congratulations: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

interface TelegramSettingsFormProps {
  userId: string;
  settings: Tables<"telegram_settings"> | null;
  initialCongratulations?: Array<{ id: string; text: string }>;
}

export default function TelegramSettingsForm({
  userId,
  settings,
  initialCongratulations,
}: TelegramSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedChats, setDetectedChats] = useState<DetectedChat[] | null>(
    null,
  );
  const [detectStatus, setDetectStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const [centralBot, setCentralBot] = useState<TelegramBotInfo | null>(null);

  useEffect(() => {
    getCentralBotInfoAction().then(setCentralBot);
  }, []);

  // Токен из БД возвращается замаскированным ("12345678…"), чтобы не
  // показывать его в браузере. Маскированное значение сохраняется без изменений.
  const isMaskedBotToken = (token: string | null | undefined) =>
    Boolean(token) && token!.endsWith("…");

  // Format time from database (e.g., "09:00:00" to "09:00")
  const formatTimeForInput = (timeString: string | undefined) => {
    if (!timeString) return "09:00";
    return timeString.substring(0, 5); // Extract HH:MM part
  };

  // Initialize form with existing settings data if available
  const form = useForm<z.infer<typeof formSchema>>({
    // resolver: zodResolver(formSchema),
    defaultValues: {
      chat_id: settings?.chat_id || "",
      bot_token: settings?.bot_token || "", // This will convert null to empty string
      notification_time: formatTimeForInput(
        settings?.notification_time ?? undefined,
      ),
      timezone: settings?.timezone || "GMT+3",
      days_before: settings?.days_before ?? 0,
      message_template:
        settings?.message_template || "Today is {{name}}'s birthday!",
      use_random_congratulations: settings?.use_random_congratulations ?? false,
      is_active: settings?.is_active ?? true,
    },
  });

  const useRandom = form.watch("use_random_congratulations");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      // Define the type for updateData
      type UpdateData = {
        chat_id: string;
        bot_token?: string | null;
        notification_time: string;
        days_before: number;
        message_template: string;
        use_random_congratulations: boolean;
        is_active: boolean;
        updated_at: string;
        timezone?: string; // Make timezone optional
      };

      // Create the updateData object with the correct type
      const updateData: UpdateData = {
        chat_id: values.chat_id,
        bot_token: values.bot_token || null,
        notification_time: `${values.notification_time}:00`, // Add seconds
        days_before: values.days_before,
        message_template: values.message_template,
        use_random_congratulations: values.use_random_congratulations,
        is_active: values.is_active,
        updated_at: new Date().toISOString(),
      };

      // Now you can safely assign the timezone
      updateData.timezone = values.timezone;

      if (settings) {
        // Update existing settings.
        // Если токен не менялся (пустое поле или маска), сохраняем текущий.
        const payload: UpdateData = { ...updateData };
        if (!values.bot_token || isMaskedBotToken(values.bot_token)) {
          payload.bot_token = undefined;
        }

        const { error } = await supabase
          .from("telegram_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) throw error;
      } else {
        // Create new settings
        const insertData = {
          user_id: userId,
          ...updateData,
        };

        const { error } = await supabase
          .from("telegram_settings")
          .insert(insertData);

        if (error) throw error;
      }

      router.refresh();
      setTestStatus({ success: true, message: "Settings saved successfully!" });
    } catch (error) {
      console.error("Error saving telegram settings:", error);
      setTestStatus({ success: false, message: "Error saving settings." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function testConnection() {
    const values = form.getValues();
    if (!values.chat_id) {
      setTestStatus({
        success: false,
        message: "Укажите ID чата для проверки.",
      });
      return;
    }

    if (values.bot_token && isMaskedBotToken(values.bot_token)) {
      setTestStatus({
        success: false,
        message:
          "Введите новый токен бота, чтобы проверить соединение (текущий скрыт).",
      });
      return;
    }

    setTestStatus({ message: "Проверка соединения..." });

    try {
      const result = await sendTelegramMessageAction(
        values.chat_id,
        "🎂 Тестовое сообщение от Birthday Bot! Соединение работает.",
        values.bot_token || null,
      );

      if (result.ok) {
        setTestStatus({
          success: true,
          message: "Соединение успешно! Тестовое сообщение отправлено.",
        });
      } else {
        setTestStatus({
          success: false,
          message: `Ошибка: ${result.error || "Неизвестная ошибка"}.`,
        });
      }
    } catch (error) {
      console.error("Error testing Telegram connection:", error);
      setTestStatus({
        success: false,
        message: "Не удалось проверить соединение.",
      });
    }
  }

  async function detectChat() {
    setIsDetecting(true);
    setDetectStatus({ message: "Поиск чатов..." });

    try {
      const botToken = form.getValues().bot_token || null;
      const result = await detectChatsAction(botToken);

      if (result.error) {
        setDetectedChats(null);
        setDetectStatus({ success: false, message: result.error });
      } else if (result.chats && result.chats.length > 0) {
        setDetectedChats(result.chats);
        setDetectStatus({
          success: true,
          message: `Найдено чатов: ${result.chats.length}. Выберите нужный.`,
        });
      }
    } catch (error) {
      console.error("Error detecting chats:", error);
      setDetectedChats(null);
      setDetectStatus({
        success: false,
        message: "Ошибка при определении чата. Попробуйте ещё раз.",
      });
    } finally {
      setIsDetecting(false);
    }
  }

  async function previewMessageTemplate() {
    const template = form.getValues().message_template;

    try {
      // Получаем список контактов
      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("name, notes, birth_date")
        .limit(1);

      if (error) throw error;

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        let message = template;

        // Рассчитываем дни до дня рождения
        const today = new Date();
        const birthDate = new Date(contact.birth_date);
        const birthDateThisYear = new Date(
          today.getFullYear(),
          birthDate.getMonth(),
          birthDate.getDate(),
        );

        // Если день рождения уже прошел в этом году, устанавливаем на следующий год
        if (birthDateThisYear < today) {
          birthDateThisYear.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = birthDateThisYear.getTime() - today.getTime();
        const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Заменяем плейсхолдеры
        message = message.replace(/{{name}}/g, contact.name);
        message = message.replace(/{{days}}/g, daysUntil.toString());
        message = message.replace(/{{notes}}/g, contact.notes || "");

        setPreviewMessage(message);
        setPreviewOpen(true);
      } else {
        setPreviewMessage(
          "Не найдено контактов для предпросмотра. Добавьте хотя бы один контакт.",
        );
        setPreviewOpen(true);
      }
    } catch (error) {
      console.error("Error previewing message:", error);
      setPreviewMessage("Ошибка при создании предпросмотра сообщения.");
      setPreviewOpen(true);
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-card p-6 rounded-lg border shadow-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-[#0A84FF]/10 p-4 rounded-lg border border-[#0A84FF]/20 mb-6">
            <h3 className="font-medium text-[#0A84FF] mb-2 flex items-center gap-2 text-sm">
              <InfoIcon className="h-4 w-4" />
              Как настроить интеграцию с Telegram:
            </h3>
            <ol className="list-decimal pl-5 text-[#0A84FF]/90 space-y-1 ml-2 text-sm">
              {centralBot?.username ? (
                <li>
                  Добавьте бота{" "}
                  <span className="font-medium">@{centralBot.username}</span> в
                  вашу группу
                </li>
              ) : (
                <li>
                  Добавьте бота приложения в вашу группу (или используйте своего
                  бота)
                </li>
              )}
              <li>
                Узнайте ID группы: добавьте в неё{" "}
                <a
                  href="https://t.me/RawDataBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#0A84FF] hover:text-[#0A84FF]/80 text-sm"
                >
                  @RawDataBot
                </a>
                , он напишет ID чата в группу
              </li>
              <li>
                Вставьте ID группы в поле «ID чата» ниже и нажмите «Проверить
                соединение» — в группу придёт тестовое сообщение
              </li>
              <li>
                Свой бот (необязательно): создайте его в{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#0A84FF] hover:text-[#0A84FF]/80 text-sm"
                >
                  @BotFather
                </a>
                , вставьте токен в поле ниже и используйте «Определить чат»
              </li>
            </ol>
          </div>

          <FormField
            control={form.control}
            name="chat_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID чата</FormLabel>
                <FormControl>
                  <Input placeholder="123456789" {...field} />
                </FormControl>
                <FormDescription>
                  Ваш ID чата Telegram или ID группы, куда будут отправляться
                  уведомления. Для группы узнайте ID через @RawDataBot (см.
                  инструкцию выше) или нажмите «Определить чат» при
                  использовании своего бота.
                </FormDescription>
                <div className="mt-2 flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={detectChat}
                    disabled={isDetecting}
                    className="w-fit"
                  >
                    {isDetecting ? "Поиск..." : "Определить чат"}
                  </Button>
                  {detectStatus && (
                    <p
                      className={`text-sm ${detectStatus.success ? "text-green-600" : detectStatus.success === false ? "text-red-600" : "text-blue-600"}`}
                    >
                      {detectStatus.message}
                    </p>
                  )}
                  {detectedChats && detectedChats.length > 0 && (
                    <div className="max-h-48 space-y-1 overflow-auto rounded-md border p-2">
                      {detectedChats.map((chat) => (
                        <button
                          key={chat.chatId}
                          type="button"
                          onClick={() => {
                            form.setValue("chat_id", chat.chatId);
                            setDetectStatus({
                              success: true,
                              message: `Выбран чат: ${chat.title}`,
                            });
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                        >
                          <span className="truncate">{chat.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {chat.type === "private" ? "личный чат" : "группа"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bot_token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Токен бота</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="123456789:ABCdefGhIJKlmnOPQRstUVwxYZ"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  Необязательно. Оставьте пустым, чтобы использовать общего бота
                  приложения. Если у вас есть свой бот от BotFather — вставьте
                  его токен (сохраняется скрытым).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button
              type="button"
              variant="default"
              onClick={testConnection}
              disabled={isSubmitting || !form.getValues().chat_id}
            >
              Проверить соединение
            </Button>
            {testStatus && (
              <div
                className={`text-sm ${testStatus.success ? "text-green-600" : testStatus.success === false ? "text-red-600" : "text-blue-600"}`}
              >
                {testStatus.message}
              </div>
            )}
          </div>

          <div className="border-t pt-6 mt-6">
            <h3 className="text-lg font-medium mb-4">Настройки уведомлений</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="notification_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Время уведомления</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription>
                      Время дня для отправки уведомлений (24-часовой формат).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Часовой пояс</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="GMT-12">GMT-12</option>
                        <option value="GMT-11">GMT-11</option>
                        <option value="GMT-10">GMT-10</option>
                        <option value="GMT-9">GMT-9</option>
                        <option value="GMT-8">GMT-8</option>
                        <option value="GMT-7">GMT-7</option>
                        <option value="GMT-6">GMT-6</option>
                        <option value="GMT-5">GMT-5</option>
                        <option value="GMT-4">GMT-4</option>
                        <option value="GMT-3">GMT-3</option>
                        <option value="GMT-2">GMT-2</option>
                        <option value="GMT-1">GMT-1</option>
                        <option value="GMT+0">GMT+0</option>
                        <option value="GMT+1">GMT+1</option>
                        <option value="GMT+2">GMT+2</option>
                        <option value="GMT+3">GMT+3</option>
                        <option value="GMT+4">GMT+4</option>
                        <option value="GMT+5">GMT+5</option>
                        <option value="GMT+6">GMT+6</option>
                        <option value="GMT+7">GMT+7</option>
                        <option value="GMT+8">GMT+8</option>
                        <option value="GMT+9">GMT+9</option>
                        <option value="GMT+10">GMT+10</option>
                        <option value="GMT+11">GMT+11</option>
                        <option value="GMT+12">GMT+12</option>
                      </select>
                    </FormControl>
                    <FormDescription>
                      Выберите ваш часовой пояс для уведомлений.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="days_before"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Предварительное уведомление
                      <Popover>
                        <PopoverTrigger>
                          <InfoIcon className="h-4 w-4 text-muted-foreground" />
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <p className="text-sm">
                            Установите 0 для уведомлений только в день рождения.
                            Установите 1 или больше, чтобы также получать
                            предварительные уведомления за указанное количество
                            дней до события.
                          </p>
                        </PopoverContent>
                      </Popover>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="30" {...field} />
                    </FormControl>
                    <FormDescription>
                      Количество дней для отправки напоминания заранее (0-30).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {useRandom ? (
              <div className="mt-6 space-y-2">
                <FormLabel>Поздравления</FormLabel>
                <FormDescription>
                  Отправляется случайное поздравление из списка ниже. Можно
                  редактировать или удалять любые сообщения.
                </FormDescription>
                <CongratulationsManager
                  userId={userId}
                  initialRows={initialCongratulations ?? []}
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="message_template"
                render={({ field }) => (
                  <FormItem className="mt-6">
                    <FormLabel>Шаблон сообщения</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Сегодня день рождения у {{name}}!"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Настройте ваше поздравление. Используйте {"{{name}}"} для
                      имени человека, {"{{days}}"} для количества дней до дня
                      рождения и {"{{notes}}"} для любых заметок.
                    </FormDescription>
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="default"
                        onClick={previewMessageTemplate}
                      >
                        Проверить сообщение
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="use_random_congratulations"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-6">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Случайные поздравления
                    </FormLabel>
                    <FormDescription>
                      Отправлять случайное поздравление из базы 650 уникальных
                      текстов вместо шаблона выше.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mt-6">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Включить уведомления
                    </FormLabel>
                    <FormDescription>
                      Включить или выключить уведомления о днях рождения.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="apple"
              className="dark:bg-[#0A84FF] dark:text-white dark:hover:bg-[#0A84FF]/90"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить настройки"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="dark:bg-[#2c2c2e] dark:text-white dark:border-[#38383a] dark:hover:bg-[#3a3a3c]"
            >
              Отмена
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Предпросмотр сообщения</DialogTitle>
            <DialogDescription>
              Так будет выглядеть ваше сообщение в Telegram:
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md mt-2 mb-4">
            <p className="whitespace-pre-wrap text-foreground">
              {previewMessage}
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="apple"
              className="dark:bg-[#0A84FF] dark:text-white dark:hover:bg-[#0A84FF]/90"
              onClick={async () => {
                const values = form.getValues();
                if (!values.chat_id) {
                  alert("Укажите ID чата для отправки сообщения.");
                  return;
                }

                if (values.bot_token && isMaskedBotToken(values.bot_token)) {
                  alert(
                    "Введите новый токен бота, чтобы отправить тестовое сообщение (текущий скрыт).",
                  );
                  return;
                }

                try {
                  const result = await sendTelegramMessageAction(
                    values.chat_id,
                    previewMessage,
                    values.bot_token || null,
                  );

                  if (result.ok) {
                    alert("Сообщение успешно отправлено!");
                    setPreviewOpen(false);
                  } else {
                    alert(
                      `Ошибка при отправке: ${result.error || "Неизвестная ошибка"}`,
                    );
                  }
                } catch (error) {
                  console.error("Error sending message:", error);
                  alert(
                    "Ошибка при отправке сообщения. Проверьте консоль для деталей.",
                  );
                }
              }}
            >
              Отправить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
