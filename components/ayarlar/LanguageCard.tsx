"use client";

/**
 * LANGUAGE CARD — Arayüz dili seçici.
 *
 * 7 dil arasında geçiş. Seçim localStorage'a persist edilir.
 */

import { useT, useI18n } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { SUPPORTED_LOCALES } from "@/lib/i18n/types";

const LOCALE_META: Record<Locale, { label: string; flag: string }> = {
  en: { label: "English",    flag: "🇬🇧" },
  tr: { label: "Türkçe",     flag: "🇹🇷" },
  de: { label: "Deutsch",    flag: "🇩🇪" },
  zh: { label: "中文",        flag: "🇨🇳" },
  ja: { label: "日本語",      flag: "🇯🇵" },
  ko: { label: "한국어",      flag: "🇰🇷" },
  ru: { label: "Русский",    flag: "🇷🇺" },
};

export function LanguageCard(): React.ReactElement {
  const t = useT();
  const { locale, setLocale } = useI18n();

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="mb-3">
        <div className="text-text-t1 font-mono text-sm font-medium">
          {t("settings.language.label")}
        </div>
        <div className="text-text-t3 mt-0.5 font-mono text-2xs">
          {t("settings.language.description")}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SUPPORTED_LOCALES.map((loc) => {
          const meta = LOCALE_META[loc];
          return (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              className={`flex items-center justify-center gap-1.5 rounded border py-1.5 font-mono text-xs font-medium tracking-wider transition-colors ${
                locale === loc
                  ? "border-text-t1 bg-surface-s2 text-text-t1"
                  : "border-border text-text-t3 hover:text-text-t2"
              }`}
            >
              <span>{meta.flag}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
