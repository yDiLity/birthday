"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { getDictionary, type Locale, type Dictionary } from "@/lib/i18n";

interface I18nContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "ru",
  t: getDictionary("ru"),
  setLocale: () => {},
});

const LOCALE_KEY = "birthday-reminder-locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(LOCALE_KEY) as Locale) || "ru";
    }
    return "ru";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const value = {
    locale,
    t: getDictionary(locale),
    setLocale,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
