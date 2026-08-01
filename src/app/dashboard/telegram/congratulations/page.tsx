import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../../supabase/server";
import { createAdminClient } from "../../../../../supabase/admin";
import { buildSeedRows } from "@/lib/congratulations";
import DashboardNavbar from "@/components/dashboard-navbar";
import CongratulationsManager from "@/components/telegram/congratulations-manager";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function CongratulationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Первичное заполнение пула поздравлений, если у пользователя их ещё нет
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

  const { data: rows } = await supabase
    .from("congratulations")
    .select("id, text")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <DashboardNavbar />
      <main className="p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button asChild variant="outline" size="icon">
              <Link href="/dashboard/telegram" aria-label="Назад к Telegram">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Поздравления</h1>
              <p className="text-muted-foreground text-sm">
                Список всех возможных сообщений. Можно редактировать или
                удалять — они используются в диалоге поздравлений и в Telegram
                (если включены случайные).
              </p>
            </div>
          </div>

          <CongratulationsManager userId={user.id} initialRows={rows ?? []} />
        </div>
      </main>
    </>
  );
}
