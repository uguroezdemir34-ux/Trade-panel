"use client";

import { useSettingsStore } from "@/lib/store/settingsStore";
import { useHydrated } from "@/lib/store/hydration";

export function ThemeToggle(): React.ReactElement | null {
  const hydrated = useHydrated();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  if (!hydrated) return null;

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="border-border bg-bg-card hover:border-border-strong flex h-7 w-7 items-center justify-center rounded border transition-colors"
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="text-sm leading-none" aria-hidden>
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
