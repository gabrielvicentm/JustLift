import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Language, TranslationKey } from "@/i18n/translations";
import { translations } from "@/i18n/translations";
import { loadPersistedJSON, savePersistedJSON } from "@/utils/persistence";

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const LANGUAGE_STORAGE_KEY = "app_language_v1";

type I18nProviderProps = {
  children: React.ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
  const [hydrated, setHydrated] = useState(false);
  const [language, setLanguage] = useState<Language>("pt");

  useEffect(() => {
    let active = true;

    async function hydrateLanguage() {
      const persisted = await loadPersistedJSON<{ language?: Language }>(LANGUAGE_STORAGE_KEY);

      if (!active) {
        return;
      }

      if (persisted?.language === "pt" || persisted?.language === "en") {
        setLanguage(persisted.language);
      }

      setHydrated(true);
    }

    hydrateLanguage().catch(() => {
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    savePersistedJSON(LANGUAGE_STORAGE_KEY, { language }).catch(() => undefined);
  }, [hydrated, language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey) => translations[language][key] ?? key,
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n precisa ser usado dentro de I18nProvider");
  }

  return context;
}
