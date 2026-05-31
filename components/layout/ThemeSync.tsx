"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function ThemeSync(): null {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }, [theme]);

  // Enable smooth transitions after initial paint to avoid FOUC
  useEffect(() => {
    const t = setTimeout(() => {
      document.documentElement.classList.add("theme-ready");
    }, 150);
    return () => clearTimeout(t);
  }, []);

  return null;
}
