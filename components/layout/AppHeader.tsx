"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useHydrated } from "@/lib/store/hydration";
import { useT } from "@/lib/i18n/context";
import { ConnectionBadge } from "./ConnectionBadge";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { LanguageDropdown } from "@/components/ui/LanguageDropdown";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TABS } from "@/lib/nav/tabs";

export function AppHeader(): React.ReactElement {
  const hydrated = useHydrated();
  const demoMode = useSettingsStore((s) => s.demoMode);
  const forwardTestMode = useSettingsStore((s) => s.forwardTestMode);
  const t = useT();
  const pathname = usePathname();

  return (
    <header
      className="border-border bg-bg/80 sticky top-0 z-30 border-b backdrop-blur-md"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        boxShadow: "0 1px 0 0 rgba(195, 85, 35, 0.08), 0 8px 24px -12px rgba(82, 35, 135, 0.20)",
      }}
    >
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-2 lg:px-6">
        {/* Left: Brand */}
        <div className="flex-shrink-0">
          <BrandHeader />
        </div>

        {/* Center: Desktop nav tabs */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
          {TABS.map((tab) => {
            const active = pathname === tab.path;
            return (
              <Link
                key={tab.id}
                href={tab.path}
                prefetch={false}
                className={[
                  "flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs tracking-wider transition-colors",
                  active
                    ? "bg-bg-card text-brand border-border border"
                    : "text-text-t3 hover:text-text-t2 hover:bg-bg-card",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-sm leading-none" aria-hidden>{tab.icon}</span>
                <span>{t(tab.shortKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <LanguageDropdown />
          <ThemeToggle />
          <ConnectionBadge />
          {hydrated && (
            <>
              {demoMode && (
                <span className="bg-soft-blue text-signal-blue rounded px-2 py-0.5 font-mono text-2xs tracking-wider">
                  {t("app.demo")}
                </span>
              )}
              {forwardTestMode && (
                <span className="bg-soft-amber text-signal-amber rounded px-2 py-0.5 font-mono text-2xs tracking-wider">
                  {t("app.forwardTest")}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
