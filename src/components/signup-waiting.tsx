"use client";

import { Button } from "@/components/ui/button";
import { checkSignupConfirmationAction } from "@/app/actions";
import { createClient } from "../../supabase/client";
import { LoaderCircle, MailCheck, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 120; // ~10 минут ожидания

type WaitingStatus = "waiting" | "done" | "stopped";

/**
 * Экран «откройте ссылку из письма». Раз в несколько секунд пытается войти
 * (данные регистрации лежат в HttpOnly-cookie): пока email не подтверждён,
 * Supabase отвечает «not confirmed», а после подтверждения с любого
 * устройства вход проходит и страница сама уводит в /dashboard.
 */
export function SignupWaiting({ email }: { email: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<WaitingStatus>("waiting");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      try {
        const result = await checkSignupConfirmationAction();
        if (cancelled) return;

        if (result.status === "ok") {
          setStatus("done");
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        if (result.status === "waiting") {
          attempts += 1;
          if (attempts >= MAX_ATTEMPTS) {
            setStatus("stopped");
            return;
          }
          timer = setTimeout(tick, POLL_INTERVAL_MS);
          return;
        }
      } catch {
        // Сетевая ошибка — подождём и попробуем снова.
        if (!cancelled) {
          timer = setTimeout(tick, POLL_INTERVAL_MS * 2);
          return;
        }
      }

      if (!cancelled) setStatus("stopped");
    };

    void tick();

    const secondsTimer = setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(secondsTimer);
    };
  }, [router]);

  // Если пользователь уже вошёл (например, открыл ссылку в этом же браузере) —
  // сразу уводим на панель.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && status === "waiting") {
        setStatus("done");
        router.replace("/dashboard");
        router.refresh();
      }
    });
  }, [router, supabase, status]);

  return (
    <div className="mt-6 space-y-4 text-center">
      {status !== "stopped" ? (
        <>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Ждём подтверждения почты…
          </div>
          <p className="text-sm text-muted-foreground">
            Мы отправили письмо на{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Откройте ссылку с любого устройства — как только вы её нажмёте,
            эта страница автоматически войдёт в аккаунт.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Проверяем каждые 5 секунд · прошло {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <MailCheck className="h-4 w-4" />
            Долгое ожидание подтверждения
          </div>
          <p className="text-sm text-muted-foreground">
            Похоже, ссылка ещё не открыта или срок действия данных истёк.
            Подтвердите почту по ссылке из письма и войдите вручную.
          </p>
        </>
      )}

      <Button asChild variant="outline" className="w-full gap-2">
        <Link href="/sign-in">
          <LogIn className="mr-2 h-4 w-4" />
          Войти вручную
        </Link>
      </Button>
    </div>
  );
}
