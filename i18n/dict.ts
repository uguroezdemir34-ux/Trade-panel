/**
 * I18N DICT — Locale → Dictionary mapping ve helper'lar.
 */

import type { Dictionary, Locale } from "./types";
import { SUPPORTED_LOCALES } from "./types";
import { en } from "./en";
import { tr } from "./tr";
import { de } from "@/lib/i18n/de";
import { fr } from "@/lib/i18n/fr";
import { es } from "@/lib/i18n/es";
import { pt } from "@/lib/i18n/pt";
import { zh } from "@/lib/i18n/zh";
import { ja } from "@/lib/i18n/ja";
import { ko } from "@/lib/i18n/ko";
import { ru } from "@/lib/i18n/ru";
import { ar } from "@/lib/i18n/ar";
import { hi } from "@/lib/i18n/hi";

export { SUPPORTED_LOCALES };

export const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  tr,
  de,
  fr,
  es,
  pt,
  zh,
  ja,
  ko,
  ru,
  ar,
  hi,
};

/**
 * Dot-notation path → nested value.
 *
 * @example
 *   getNested(dict, "nav.decision") → "Decision" / "Karar"
 */
function getNested(obj: unknown, path: string): string {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in cur) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return path; // fallback: key'i göster (developer için debug)
    }
  }
  return typeof cur === "string" ? cur : path;
}

/**
 * Template string'lerde {placeholder} değerleri.
 *
 * @example
 *   interpolate("Need ${n} USD", { n: "100" }) → "Need 100 USD"
 *   interpolate("Risk %{pct}", { pct: "0.5" }) → "Risk %0.5"
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  let result = template;
  for (const [key, val] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
  }
  return result;
}

/**
 * Translate fonksiyonu.
 * Path yoksa key'i döner (developer için debug, kullanıcı için "nav.decision" görünür).
 */
export function translate(
  dict: Dictionary,
  path: string,
  params?: Record<string, string | number>,
): string {
  const raw = getNested(dict, path);
  return interpolate(raw, params);
}

/**
 * Dual-layer locale detection:
 * Layer 1: User's explicit saved preference (localStorage)
 * Layer 2: Browser language → mapped to supported locale
 * Fallback: "en"
 */
export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";

  // Layer 1: explicit stored preference
  try {
    const stored = window.localStorage.getItem("ug52_locale");
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) return stored as Locale;
  } catch { /* ignore */ }

  // Layer 2: browser language detection
  if (typeof navigator !== "undefined") {
    const lang = navigator.language.toLowerCase();
    const browserMap: Record<string, Locale> = {
      tr: "tr", de: "de", fr: "fr", es: "es", pt: "pt",
      zh: "zh", ja: "ja", ko: "ko", ru: "ru", ar: "ar", hi: "hi",
    };
    for (const [prefix, locale] of Object.entries(browserMap)) {
      if (lang.startsWith(prefix)) return locale;
    }
  }

  return "en";
}

/** Locale persist */
export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("ug52_locale", locale);
  } catch {
    // ignore
  }
}
