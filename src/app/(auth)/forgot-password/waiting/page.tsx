import { ResetWaiting } from "@/components/reset-waiting";
import { ThemeToggle } from "@/components/theme-toggle";
import { KeyRound } from "lucide-react";
import Link from "next/link";

interface ResetWaitingPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function ForgotPasswordWaitingPage({
  searchParams,
}: ResetWaitingPageProps) {
  const params = await searchParams;
  const email = params.email ?? "";

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
            <KeyRound className="h-9 w-9 text-white" />
          </div>

          <h1 className="mb-1 mt-4 text-xl font-semibold">
            Подтвердите сброс с телефона
          </h1>
          <p className="text-sm text-muted-foreground">
            Откройте ссылку из письма — новый пароль зададим здесь, на
            компьютере
          </p>

          <ResetWaiting email={email} />
        </div>
      </div>
    </section>
  );
}
