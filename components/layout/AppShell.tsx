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
import { useBalancePoller } from "@/lib/hooks/useBalancePoller";
import { useMacroPoller } from "@/lib/hooks/useMacroPoller";
import { useOrderBookPoller } from "@/lib/hooks/useOrderBookPoller";
import { useNewsPoller } from "@/lib/hooks/useNewsPoller";
import { useEquityIndexPoller } from "@/lib/hooks/useEquityIndexPoller";
import { NewsFeedBanner } from "./NewsFeedBanner";
import { useDailyPnlTracker } from "@/lib/hooks/useDailyPnlTracker";
import { useTradeFeed } from "@/lib/hooks/useTradeFeed";
import { useSignalFirehose } from "@/lib/hooks/useSignalFirehose";
import { usePriceAlarms } from "@/lib/hooks/usePriceAlarms";
import { useScoreMomentumAlerts } from "@/lib/hooks/useScoreMomentumAlerts";
import { useConsecutiveLossAlert } from "@/lib/hooks/useConsecutiveLossAlert";
import { useCredentialStore } from "@/lib/store/credentialStore";
import { useLiqFeed } from "@/lib/hooks/useLiqFeed";
import { usePwaSetup } from "@/lib/hooks/usePwaSetup";
import { useEmergencyStopGuard } from "@/lib/hooks/useEmergencyStopGuard";
import { useSlProximityAlert } from "@/lib/hooks/useSlProximityAlert";
import { usePriorityAlerts } from "@/lib/hooks/usePriorityAlerts";
import { useCapacitorApp } from "@/lib/hooks/useCapacitorApp";
import { useGoSignalOutcomeTracker } from "@/lib/hooks/useGoSignalOutcomeTracker";
import { QuickTradeSheet } from "@/components/mobile/QuickTradeSheet";
import { DisclaimerModal } from "./DisclaimerModal";
import { useAuthStub } from "@/lib/auth/stubs";
import { setCurrentUserId } from "@/lib/auth/scope";
import { migrateStorageForUser } from "@/lib/auth/migrate";
import { fetchTradesFromServer, bulkSyncTradesToServer } from "@/lib/db/tradeSync";
import { useMacroStore } from "@/lib/store/macroStore";
import { useWatchlistStore } from "@/lib/store/watchlistStore";

// Calibration helper — only active when ?calib=1 is in the URL
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("calib") === "1") {
  (window as unknown as Record<string, unknown>).useMacroStore = useMacroStore;
}

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
  const mergeTradesFromDb = useTradesStore((s) => s.mergeFromDb);
  const loadWatchlist = useWatchlistStore((s) => s.load);
  const loadCredentials = useCredentialStore((s) => s.load);
  const { userId, isLoaded: authLoaded } = useAuthStub();

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
  useBalancePoller(2_000);  // t+2s
  useMacroPoller(3_000);    // t+3s — en yavaş değişen veri, en son
  useOrderBookPoller(4_000); // t+4s — Anomali Işığı Faz 2 (order book duvarı), 3dk cadence
  useNewsPoller(5_000);      // t+5s — Haber Akışı (RSS+Finnhub haber sentiment), 20dk cadence
  useEquityIndexPoller(6_000); // t+6s — S&P/Nasdaq/DXY proxy (SPY/QQQ/UUP), 5dk cadence, veri katmanı (UI henüz yok)
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
  // Ardışık zarar alarmı — 3+ ardışık zararı Telegram'a bildir
  useConsecutiveLossAlert();
  // Gerçek OKX liquidation-orders feed — liq haritası için (OHLCV tahmininin yerini alır)
  useLiqFeed();
  // Acil stop guard — OKX algo emri tetiklenmezse client tarafı SL koruması
  useEmergencyStopGuard();
  // SL yaklaştığında Telegram bildirimi — %3 eşiği, 15 dak cooldown
  useSlProximityAlert();
  // Watchlist pair'leri için öncelikli browser bildirimi (⭐ GO)
  usePriorityAlerts();
  // PWA kurulumu — SW kayıt + install prompt yakalama
  usePwaSetup();
  // Capacitor native lifecycle — back button, StatusBar, SplashScreen
  useCapacitorApp();
  // GO sinyal sonrası 15dk/1sa fiyat hareketi takibi
  useGoSignalOutcomeTracker();

  useEffect(() => {
    if (!authLoaded) return;

    // Scope localStorage to current user BEFORE rehydrating stores.
    if (userId) {
      // One-time migration: copy legacy ug52_* keys → ug52_{userId}_*
      migrateStorageForUser(userId);
      setCurrentUserId(userId);
    }

    rehydrateSettings();
    rehydrateAccount();
    rehydrateRisk();
    rehydrateTrades();
    loadWatchlist();
    void loadCredentials();

    if (!splashShownToday()) {
      setShowSplash(true);
    }

    // DB sync — only for logged-in users (guests skip)
    if (userId) {
      void (async () => {
        const dbTrades = await fetchTradesFromServer();
        if (dbTrades && dbTrades.length > 0) {
          mergeTradesFromDb(dbTrades);
        }
        // One-time bulk sync: push any localStorage trades not yet in DB
        // Use getState() to read current store after rehydration (avoids stale closure)
        const storeState = useTradesStore.getState();
        const localTrades = [
          ...storeState.trades,
          ...storeState.archivedTrades,
        ].filter((t) => t.status === "closed");
        if (localTrades.length > 0) {
          void bulkSyncTradesToServer(localTrades);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, userId]);

  return (
    <div className="bg-bg text-text-t1 min-h-screen">
      <ThemeSync />
      <DisclaimerModal />
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <AppHeader />
      <NewsFeedBanner />
      <AlarmToastContainer />
      <main className="app-main mx-auto max-w-screen-2xl px-4 pt-4 lg:px-6">
        {children}
      </main>
      <BottomNav />
      <QuickTradeSheet />
    </div>
  );
}
