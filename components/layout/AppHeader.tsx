"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useHydrated } from "@/lib/store/hydration";
import { useT } from "@/lib/i18n/context";
import { ConnectionBadge } from "./ConnectionBadge";
import { LiqFeedBadge } from "./LiqFeedBadge";
import { UserButtonStub } from "@/lib/auth/UserButtonStub";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { LanguageDropdown } from "@/components/ui/LanguageDropdown";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TABS } from "@/lib/nav/tabs";

export function AppHeader(): React.ReactElement | null {
  const hydrated = useHydrated();
  const demoMode = useSettingsStore((s) => s.demoMode);
  const dailyPnlPct = useAccountStore((s) => s.dailyPnlPct);
  const positions = usePositionStore((s) => s.positions);
  const t = useT();
  const pathname = usePathname();

  // /grafik dikey alan kazanımı — chart sayfasında header tamamen gizlenir.
  // WatchlistPanel'in sticky offset'i buna göre ayrıca sabitlendi (o bileşen
  // sadece /grafik'te kullanıldığı için route kontrolüne gerek kalmadı).
  if (pathname === "/grafik") return null;

  const openUpl = positions.reduce((sum, p) => sum + p.upl, 0);
  const openCount = positions.length;

  return (
    <header
      className="border-border bg-bg sticky top-0 z-50 border-b"
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
          <LiqFeedBadge />
          <ConnectionBadge />
          {hydrated && <UserButtonStub afterSignOutUrl="/" />}
          {hydrated && (
            <>
              {/* Open positions UPL badge */}
              {openCount > 0 && (
                <Link
                  href="/pozisyon"
                  className={`rounded px-2 py-0.5 font-mono text-2xs tabular-nums tracking-wider transition-opacity hover:opacity-80 ${
                    openUpl >= 0
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                  title={`${openCount} ${t("app.openPositions")}`}
                >
                  {openCount}P {openUpl >= 0 ? "+" : ""}{openUpl.toFixed(1)}$
                </Link>
              )}
              {/* Daily P&L badge — only show when nonzero */}
              {dailyPnlPct !== 0 && (
                <span
                  className={`rounded px-2 py-0.5 font-mono text-2xs tabular-nums tracking-wider ${
                    dailyPnlPct > 0
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                  title={t("app.dailyPnlTitle")}
                >
                  {dailyPnlPct > 0 ? "+" : ""}{dailyPnlPct.toFixed(2)}%
                </span>
              )}
              {demoMode && (
                <span className="bg-soft-blue text-signal-blue rounded px-2 py-0.5 font-mono text-2xs tracking-wider">
                  {t("app.demo")}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
