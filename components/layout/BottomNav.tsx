"use client";

/**
 * BOTTOM NAV — Sticky alt navigasyon bar.
 *
 * Panel v55.51 mobile design ile uyumlu:
 *   - Alt sabit (fixed bottom)
 *   - 7 sekme (Karar, Pozisyon, Grafik, Piyasa, Risk, P&L, Ayarlar)
 *   - Aktif sekme turuncu vurgu (#FF6B1A)
 *   - Emoji ikon + 2 satır kısa text
 *   - Tap area 64px (Apple HIG min target)
 *
 * Tab değişiminde `settingsStore.setLastTab` çağrılır → localStorage'a yazılır.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TABS } from "@/lib/nav/tabs";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useHydrated } from "@/lib/store/hydration";
import { useT } from "@/lib/i18n/context";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import { useScoreStore } from "@/lib/store/scoreStore";

export function BottomNav(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const setLastTab = useSettingsStore((s) => s.setLastTab);
  const hydrated = useHydrated();
  const t = useT();
  const triggeredAlarmCount = usePriceAlarmStore(
    (s) => s.alarms.filter((a) => a.status === "triggered").length,
  );
  const goCount = useScoreStore(
    (s) => Object.values(s.results).filter((r) => r?.verdict === "go").length,
  );

  return (
    <nav
      className="border-border bg-bg fixed bottom-0 left-0 right-0 z-40 border-t lg:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label={t("nav.ariaLabel")}
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname === tab.path || pathname.startsWith(tab.path + "/");
          return (
            <li key={tab.id}>
              <Link
                href={tab.path}
                onClick={() => {
                  if (hydrated) setLastTab(tab.id);
                }}
                className={[
                  "flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-2",
                  "select-none transition-colors",
                  active
                    ? "text-brand"
                    : "text-text-t3 hover:text-text-t2 active:text-brand",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
                onContextMenu={(e) => {
                  e.preventDefault();
                  router.refresh();
                }}
              >
                <span className="relative text-lg leading-none" aria-hidden>
                  {tab.icon}
                  {tab.id === "karar" && goCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 bg-green-500 text-white font-mono font-bold rounded-full leading-none flex items-center justify-center" style={{ fontSize: 7, minWidth: 12, height: 12, padding: "0 2px" }}>
                      {goCount > 9 ? "9+" : goCount}
                    </span>
                  )}
                  {tab.id === "ayarlar" && triggeredAlarmCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 bg-amber-400 text-black font-mono font-bold rounded-full leading-none flex items-center justify-center" style={{ fontSize: 7, minWidth: 12, height: 12, padding: "0 2px" }}>
                      {triggeredAlarmCount > 9 ? "9+" : triggeredAlarmCount}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[9px] tracking-wide leading-none">
                  {t(tab.shortKey)}
                </span>
                {active && (
                  <span
                    className="bg-brand absolute top-0 h-0.5 w-6 rounded-b-full"
                    aria-hidden
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
