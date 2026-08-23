import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { createClient } from "../../../../supabase/server";

export default async function ConfirmedPage() {
  // Ссылка подтверждения открывается на другом устройстве (например, с
  // телефона): после обмена кода на сессию это устройство уже авторизовано.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="auth-bg flex px-4 py-16 md:py-32">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="glass-card m-auto h-fit w-full max-w-sm rounded-xl p-0.5 animate-scale-in">
        <div className="p-8 text-center">
          <div className="relative flex items-center justify-center">
            <Link href="/" aria-label="go home" className="absolute left-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg gradient-bg">
                <img
                  src="/cake.svg"
                  alt="Digital Birthday Reminder"
                  className="h-6 brightness-0 invert"
                />
              </div>
            </Link>
            <span className="text-xl font-semibold tracking-tight">
              Birthday
              <span className="gradient-text ml-1">Reminder</span>
            </span>
          </div>

          <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full gradient-bg">
            <BadgeCheck className="h-9 w-9 text-white" />
          </div>

          <h1 className="mb-1 mt-4 text-xl font-semibold">
            Вы успешно зарегистрированы!
          </h1>
          <p className="text-sm text-muted-foreground">
            Ваша почта подтверждена.
            {user ? (
              <>
                <br />
                Можно продолжить прямо здесь или вернуться к компьютеру — там
                вы войдёте автоматически
              </>
            ) : (
              <>
                <br />
                Вернитесь к компьютеру — он войдёт в аккаунт автоматически
              </>
            )}
          </p>

          {user ? (
            <Button
              asChild
              className="mt-6 w-full gradient-bg text-white hover:opacity-90 transition-opacity border-0"
            >
              <Link href="/dashboard">Перейти к контактам</Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="mt-6 w-full"
            >
              <Link href="/sign-in">Войти</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
