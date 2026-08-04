import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../supabase/server";
import TelegramSettingsForm from "@/components/telegram/telegram-settings-form";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/types/supabase";
import { MessageSquareText } from "lucide-react";

export default async function TelegramSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Настройки отдаются через security definer функцию с замаскированным токеном.
  const { data: telegramSettings, error } = await supabase
    .rpc("get_my_telegram_settings")
    .maybeSingle();

  if (error) {
    console.error("Error fetching telegram settings:", error);
  }

  return (
    <main className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Интеграция с Telegram</h1>
          <Button asChild variant="outline">
            <Link href="/dashboard/telegram/congratulations">
              <MessageSquareText className="mr-2 h-4 w-4" />
              Поздравления
            </Link>
          </Button>
        </div>
        <TelegramSettingsForm
          userId={user.id}
          settings={telegramSettings as Tables<"telegram_settings"> | null}
        />
      </div>
    </main>
  );
}
