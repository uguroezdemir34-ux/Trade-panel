"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/types";

const LOCALE_META: Record<Locale, { flag: string; label: string; native: string }> = {
  en: { flag: "🇬🇧", label: "EN", native: "English" },
  tr: { flag: "🇹🇷", label: "TR", native: "Türkçe" },
  de: { flag: "🇩🇪", label: "DE", native: "Deutsch" },
  fr: { flag: "🇫🇷", label: "FR", native: "Français" },
  es: { flag: "🇪🇸", label: "ES", native: "Español" },
  pt: { flag: "🇧🇷", label: "PT", native: "Português" },
  zh: { flag: "🇨🇳", label: "ZH", native: "中文" },
  ja: { flag: "🇯🇵", label: "JA", native: "日本語" },
  ko: { flag: "🇰🇷", label: "KO", native: "한국어" },
  ru: { flag: "🇷🇺", label: "RU", native: "Русский" },
  ar: { flag: "🇸🇦", label: "AR", native: "العربية" },
  hi: { flag: "🇮🇳", label: "HI", native: "हिन्दी" },
};

export function LanguageDropdown(): React.ReactElement {
  const { locale, setLocale, hydrated } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, close]);

  const current = LOCALE_META[hydrated ? locale : "en"];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border-border bg-bg-card hover:border-border-strong flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors"
        style={{ color: "rgb(var(--text-t2))" }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-sm leading-none">{current.flag}</span>
        <span className="tracking-wider">{current.label}</span>
        <span
          className="ml-0.5 text-[8px] leading-none"
          style={{ color: "rgb(var(--text-t4))" }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="border-border bg-bg-card absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded border py-1 shadow-2xl"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
          role="listbox"
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const meta = LOCALE_META[loc];
            const active = loc === locale;
            return (
              <button
                key={loc}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(loc);
                  close();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-bg-card2"
                style={{
                  color: active ? "#FF6B1A" : "rgb(var(--text-t2))",
                  background: active ? "rgba(255,107,26,0.06)" : undefined,
                }}
              >
                <span className="text-sm leading-none">{meta.flag}</span>
                <span className="w-6 tracking-wider">{meta.label}</span>
                <span style={{ color: "rgb(var(--text-t3))", fontSize: "11px" }}>
                  {meta.native}
                </span>
                {active && (
                  <span className="ml-auto text-[10px]" style={{ color: "#FF6B1A" }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
