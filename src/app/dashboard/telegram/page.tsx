import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../supabase/server";
import { createAdminClient } from "../../../../supabase/admin";
import { buildSeedRows } from "@/lib/congratulations";
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

  // Первичное заполнение пула поздравлений, если у пользователя их ещё нет.
  try {
    const { count } = await supabase
      .from("congratulations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (!count) {
      const admin = createAdminClient();
      await admin.from("congratulations").upsert(buildSeedRows(user.id), {
        onConflict: "user_id,text",
      });
    }
  } catch (error) {
    console.error("Error seeding congratulations:", error);
  }

  const { data: congratulations } = await supabase
    .from("congratulations")
    .select("id, text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

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
          initialCongratulations={congratulations ?? []}
        />
      </div>
    </main>
  );
}
