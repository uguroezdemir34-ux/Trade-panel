import type { Locale } from "./types";

export function formatPrice(
  value: number,
  locale: Locale,
  showSign = false
): string {
  const abs = Math.abs(value);
  // Sub-cent assets (SHIB $0.000024, DOGE $0.40, etc.) need more decimals
  const maxDecimals = abs > 0 && abs < 0.001 ? 8 : abs < 0.01 ? 6 : abs < 1 ? 4 : 2;

  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals,
  }).format(abs);

  const sign = showSign ? (value >= 0 ? "+" : "−") : value < 0 ? "−" : "";
  return `${sign}$${formatted}`;
}

export function formatCoinAmount(
  value: number,
  pair: string,
  locale: Locale
): string {
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
  return `${formatted} ${pair}`;
}

export function formatPercent(
  value: number,
  locale: Locale,
  showSign = false
): string {
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  const sign = showSign ? (value >= 0 ? "+" : "−") : value < 0 ? "−" : "";
  return `${sign}${formatted}%`;
}

export function formatTime(epochMs: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochMs));
}
