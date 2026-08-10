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
import { DevicePerfSync } from "./DevicePerfSync";
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
import { useNewsPoller } from "@/lib/hooks/useNewsPoller";
import { useEquityIndexPoller } from "@/lib/hooks/useEquityIndexPoller";
import { NewsFeedBanner, NewsFeedCTA } from "./NewsFeedBanner";
import { PositionRiskBanner } from "./PositionRiskBanner";
import { useDailyPnlTracker } from "@/lib/hooks/useDailyPnlTracker";
import { useWeeklyMonthlyPnlTracker } from "@/lib/hooks/useWeeklyMonthlyPnlTracker";
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
import { useCapacitorPush } from "@/lib/hooks/useCapacitorPush";
import { useGoSignalOutcomeTracker } from "@/lib/hooks/useGoSignalOutcomeTracker";
import { useSentryReplay } from "@/lib/hooks/useSentryReplay";
import { QuickTradeSheet } from "@/components/mobile/QuickTradeSheet";
import { DisclaimerModal } from "./DisclaimerModal";
import { MasterPinModal } from "./MasterPinModal";
import { useAuthStub } from "@/lib/auth/stubs";
import { setCurrentUserId } from "@/lib/auth/scope";
import { migrateStorageForUser } from "@/lib/auth/migrate";
import { fetchTradesFromServer, bulkSyncTradesToServer } from "@/lib/db/tradeSync";
import { useMacroStore } from "@/lib/store/macroStore";
import { useWatchlistStore } from "@/lib/store/watchlistStore";
import { isNativePlatform } from "@/lib/mobile/platform";

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

/**
 * HESAP/POZİSYON HOOK'LARI — sadece web'de mount edilir.
 *
 * Native (Capacitor Android) app'te hiç render edilmez — Google Play
 * Financial Features kapsamını daraltmak için native app salt sinyal+
 * backtest aracı olarak sunuluyor, gerçek hesap/pozisyon/P&L verisi
 * çekilmiyor. Bkz. lib/hooks/useNativeRedirectGuard.ts,
 * components/mobile/QuickTradeSheet.tsx'teki aynı desenin emir-açma tarafı.
 */
function AccountExecutionHooks(): null {
  usePositionPoller(1_000);
  useBalancePoller(2_000);
  useDailyPnlTracker();
  useWeeklyMonthlyPnlTracker();
  useEmergencyStopGuard();
  useSlProximityAlert();
  useConsecutiveLossAlert();
  useGoSignalOutcomeTracker();
  return null;
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
  const isNative = isNativePlatform();

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
  useMacroPoller(3_000);    // t+3s — en yavaş değişen veri, en son
  useNewsPoller(5_000);      // t+5s — Haber Akışı (RSS+Finnhub haber sentiment), 20dk cadence
  useEquityIndexPoller(6_000); // t+6s — S&P/Nasdaq/DXY proxy (SPY/QQQ/UUP), 5dk cadence, veri katmanı (UI henüz yok)
  // useOrderBookPoller/useMarketExtrasPoller BURADAN kaldırıldı — app/karar/page.tsx'e
  // taşındı (bug taramasında bulundu: burada "global mount + hook içi pathname
  // kontrolü" ile route-gating YAPILMIYORDU, sadece her route değişiminde effect'i
  // yeniden tetekleyip erkenden çıkılıyordu — AppShell hiç unmount olmadığı için
  // gerçek mount/unmount hiç gerçekleşmiyordu. /karar'a her giriş-çıkış-giriş,
  // 4-7sn'lik sabit gecikmeyi zombi gibi yeniden tetikliyordu. Artık page.tsx'te
  // gerçek component mount/unmount'a bağlılar, hook içindeki pathname kontrolü de
  // bu yüzden kaldırıldı (gereksizleşti).
  // Order flow trade feed → tradeFeedStore (CVD/VPIN/SMC için)
  useTradeFeed();
  // Telegram sinyal firehose — verdict go geçişlerini izler
  useSignalFirehose();
  // Fiyat alarmları — hedef fiyat aşılınca Telegram bildirimi
  usePriceAlarms();
  // Skor momentum — GO öncesi hızlı yükselişte pre-alert
  useScoreMomentumAlerts();
  // Gerçek OKX liquidation-orders feed — liq haritası için (OHLCV tahmininin yerini alır)
  useLiqFeed();
  // Watchlist pair'leri için öncelikli browser bildirimi (⭐ GO)
  usePriorityAlerts();
  // PWA kurulumu — SW kayıt + install prompt yakalama
  usePwaSetup();
  // Capacitor native lifecycle — back button, StatusBar, SplashScreen
  useCapacitorApp();
  // Capacitor native push (FCM) — web'de no-op, bkz. hook doc
  useCapacitorPush();
  // Sentry Session Replay'i geç yükle — /sign-in gibi public route'larda
  // AppShell hiç render edilmediği için bu chunk oralarda hiç indirilmiyor
  useSentryReplay();

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
    // Native app'te OKX/borsa credential'ları hiç yüklenmiyor — hesap/pozisyon
    // verisi native'de gösterilmiyor (bkz. AccountExecutionHooks yorumu).
    if (!isNative) void loadCredentials();

    if (!splashShownToday()) {
      setShowSplash(true);
    }

    // DB sync — only for logged-in users (guests skip), native'de hiç yapılmıyor
    // (native app gerçek trade/P&L verisi işlemiyor, bkz. AccountExecutionHooks)
    if (userId && !isNative) {
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
    <div
      className="bg-bg text-text-t1 min-h-screen"
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <ThemeSync />
      <DevicePerfSync />
      <DisclaimerModal />
      <MasterPinModal />
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      {!isNative && <AccountExecutionHooks />}
      {!isNative && <PositionRiskBanner />}
      <AppHeader />
      <NewsFeedBanner />
      <NewsFeedCTA />
      <AlarmToastContainer />
      <main className="app-main mx-auto max-w-screen-2xl px-4 pt-4 lg:px-6">
        {children}
      </main>
      <BottomNav />
      <QuickTradeSheet />
    </div>
  );
}
