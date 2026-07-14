export type Locale = "en" | "tr" | "de" | "zh" | "ja" | "ko" | "ru";
export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "de", "zh", "ja", "tr", "ko", "ru"];
export const DEFAULT_LOCALE: Locale = "en";
export type Dictionary = {
  [key: string]: string | Dictionary;
};
