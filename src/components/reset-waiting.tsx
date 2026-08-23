"use client";

import { Button } from "@/components/ui/button";
import { checkResetRelayAction } from "@/app/actions";
import {
  LoaderCircle,
  LogIn,
  MonitorCheck,
  Smartphone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 200; // ~10 минут ожидания

type WaitingStatus = "waiting" | "done" | "stopped";

/**
 * Экран «откройте ссылку из письма на телефоне». Пока ссылка не открыта —
 * ждёт. Телефон передаст одноразовый код сюда (через relay-id в cookie),
 * этот браузер сам обменяет его на сессию — и откроется форма нового пароля.
 */
export function ResetWaiting({ email }: { email: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<WaitingStatus>("waiting");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      try {
        const result = await checkResetRelayAction();
        if (cancelled) return;

        if (result.status === "ok") {
          setStatus("done");
          router.replace("/dashboard/reset-password");
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

  return (
    <div className="mt-6 space-y-4 text-center">
      {status !== "stopped" ? (
        <>
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Ждём, пока вы откроете ссылку…
          </div>
          <p className="text-sm text-muted-foreground">
            Мы отправили письмо на{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
          <div className="mx-auto max-w-xs space-y-2 text-left text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
              Откройте письмо на телефоне и нажмите ссылку
            </p>
            <p className="flex items-start gap-2">
              <MonitorCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Здесь автоматически откроется форма нового пароля
            </p>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Проверяем каждые 3 секунды · прошло {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")}
          </p>
        </>
      ) : (
        <>
          <MonitorCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">Долгое ожидание</div>
          <p className="text-sm text-muted-foreground">
            Ссылка не открыта или срок её действия истёк (около часа).
            Откройте ссылку из письма ещё раз либо запросите новую.
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
