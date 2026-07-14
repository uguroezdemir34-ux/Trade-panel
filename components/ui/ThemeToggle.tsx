"use client";

import { useSettingsStore, type Theme } from "@/lib/store/settingsStore";
import { useHydrated } from "@/lib/store/hydration";

/** light → dark → cyber-terminal → light ... */
const NEXT_THEME: Record<Theme, Theme> = {
  light: "dark",
  dark: "cyber-terminal",
  "cyber-terminal": "light",
};

const THEME_ICON: Record<Theme, string> = {
  light: "☀️",
  dark: "🌙",
  "cyber-terminal": "🖥️",
};

const THEME_LABEL: Record<Theme, string> = {
  light: "Light mode",
  dark: "Dark mode",
  "cyber-terminal": "Cyber-Terminal",
};

export function ThemeToggle(): React.ReactElement | null {
  const hydrated = useHydrated();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  if (!hydrated) return null;

  const next = NEXT_THEME[theme];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`${THEME_LABEL[theme]} — ${THEME_LABEL[next]}'a geç`}
      className="header-control-border border-border bg-bg-card hover:border-border-strong flex h-7 w-7 items-center justify-center rounded border transition-colors"
      title={THEME_LABEL[theme]}
    >
      <span className="text-sm leading-none" aria-hidden>
        {THEME_ICON[theme]}
      </span>
    </button>
  );
}
