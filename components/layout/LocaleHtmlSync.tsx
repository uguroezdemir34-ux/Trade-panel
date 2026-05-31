"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n/context";

const RTL_LOCALES = new Set(["ar"]);

const LANG_MAP: Record<string, string> = {
  en: "en",
  tr: "tr",
  de: "de",
  fr: "fr",
  es: "es",
  pt: "pt-BR",
  zh: "zh-Hans",
  ja: "ja",
  ko: "ko",
  ru: "ru",
  ar: "ar",
  hi: "hi",
};

export function LocaleHtmlSync(): null {
  const locale = useLocale();

  useEffect(() => {
    const html = document.documentElement;
    html.lang = LANG_MAP[locale] ?? locale;
    html.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
