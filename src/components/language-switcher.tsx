"use client";

import { useI18n } from "@/lib/i18n-context";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "ru" ? "en" : "ru")}
      className="gap-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Globe className="h-4 w-4" />
      <span className="hidden sm:inline-block">
        {locale === "ru" ? "EN" : "RU"}
      </span>
    </Button>
  );
}
