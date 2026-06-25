export type Locale = "en" | "tr" | "de" | "fr" | "es" | "pt" | "zh" | "ja" | "ko" | "ru" | "ar" | "hi";
export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "de", "fr", "es", "pt", "zh", "ja", "tr", "ko", "ru", "ar", "hi"];
export const DEFAULT_LOCALE: Locale = "en";
export type Dictionary = {
  [key: string]: string | Dictionary;
};
