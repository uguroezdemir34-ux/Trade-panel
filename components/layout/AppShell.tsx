"use client";

/**
 * APP SHELL — Sayfa düzeni wrapper'ı.
 *
 * Yapı:
 *   ┌─ AppHeader (sticky top) ─┐
 *   │                          │
 *   │   {children}             │
 *   │   (sayfa içeriği)        │
 *   │                          │
 *   └─ BottomNav (fixed) ──────┘
 *
 * Content area:
 *   - max-w-2xl (mobile-first, tablet'te merkez)
 *   - padding-bottom: 64px + safe-area (bottom nav için)
 *   - mx-auto px-4
 *
 * Side-effects:
 *   - settingsStore.rehydrate() — localStorage → store
 *   - useMarketStream() — WS bağlantısı + tick stream
 */

import { useEffect, useCallback, useState } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { SplashScreen } from "./SplashScreen";
import { ThemeSync } from "./ThemeSync";
import { AlarmToastContainer } from "./AlarmToastContainer";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStream } from "@/lib/ws/useMarketStream";
import { useCandlePoller } from "@/lib/hooks/useCandlePoller";
import { usePositionPoller } from "@/lib/hooks/usePositionPoller";
import { useScoreEngine } from "@/lib/hooks/useScoreEngine";
import { useGoAlerts } from "@/lib/hooks/useGoAlerts";
import { useScoreHistory } from "@/lib/hooks/useScoreHistory";
import { useTrailingManager } from "@/lib/hooks/useTrailingManager";
import { useBalancePoller } from "@/lib/hooks/useBalancePoller";
import { useMacroPoller } from "@/lib/hooks/useMacroPoller";
import { useDailyPnlTracker } from "@/lib/hooks/useDailyPnlTracker";
import { useTradeFeed } from "@/lib/hooks/useTradeFeed";
import { useSignalFirehose } from "@/lib/hooks/useSignalFirehose";
import { usePriceAlarms } from "@/lib/hooks/usePriceAlarms";
import { useScoreMomentumAlerts } from "@/lib/hooks/useScoreMomentumAlerts";
import { useCredentialStore } from "@/lib/store/credentialStore";

const SPLASH_DATE_KEY = "qx_splash_date";

function splashShownToday(): boolean {
  try {
    return localStorage.getItem(SPLASH_DATE_KEY) === new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

function markSplashShown(): void {
  try {
    localStorage.setItem(SPLASH_DATE_KEY, new Date().toISOString().slice(0, 10));
  } catch { /* ignore */ }
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const rehydrateSettings = useSettingsStore((s) => s.rehydrate);
  const rehydrateAccount = useAccountStore((s) => s.rehydrate);
  const rehydrateRisk = useRiskStore((s) => s.rehydrate);
  const rehydrateTrades = useTradesStore((s) => s.rehydrate);
  const loadCredentials = useCredentialStore((s) => s.load);

  // Splash: günde bir kez göster (localStorage tarih kontrolü)
  const [showSplash, setShowSplash] = useState(false);

  const handleSplashDone = useCallback(() => {
    markSplashShown();
    setShowSplash(false);
  }, []);

  // Critical path — start immediately
  useMarketStream();    // WS bağlantısı — gecikme yok
  useCandlePoller();    // Cache'den anında veri, sonra fetch
  useScoreEngine();     // Candle'a bağlı, candle hazır olunca çalışır
  useGoAlerts();        // GO verdict geçişlerini Telegram'a gönder
  useScoreHistory();    // Her hesaplama sonucunu geçmiş store'a kaydet

  // Secondary — staggered to avoid startup thundering herd
  usePositionPoller(1_000); // t+1s
  useTrailingManager();     // candle-triggered, etkisiz erken çalışsa da
  useBalancePoller(2_000);  // t+2s
  useMacroPoller(3_000);    // t+3s — en yavaş değişen veri, en son
  // Günlük P&L takip → drawdown protokol tier güncelle (güvenlik kritik)
  useDailyPnlTracker();
  // Order flow trade feed → tradeFeedStore (CVD/VPIN/SMC için)
  useTradeFeed();
  // Telegram sinyal firehose — verdict go geçişlerini izler
  useSignalFirehose();
  // Fiyat alarmları — hedef fiyat aşılınca Telegram bildirimi
  usePriceAlarms();
  // Skor momentum — GO öncesi hızlı yükselişte pre-alert
  useScoreMomentumAlerts();

  useEffect(() => {
    rehydrateSettings();
    rehydrateAccount();
    rehydrateRisk();
    rehydrateTrades();
    void loadCredentials();

    // Splash: bugün henüz gösterilmediyse aç
    if (!splashShownToday()) {
      setShowSplash(true);
    }
  }, [rehydrateSettings, rehydrateAccount, rehydrateRisk, rehydrateTrades, loadCredentials]);

  return (
    <div className="bg-bg text-text-t1 min-h-screen">
      <ThemeSync />
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <AppHeader />
      <AlarmToastContainer />
      <main className="app-main mx-auto max-w-screen-2xl px-4 pt-4 lg:px-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
