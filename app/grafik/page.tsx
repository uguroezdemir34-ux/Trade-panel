"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useFocusStore } from "@/lib/store/focusStore";
import { useT } from "@/lib/i18n/context";
import { ChartControls, type ChartClickMode } from "@/components/grafik/ChartControls";
import { ChartLegend } from "@/components/grafik/ChartLegend";
import { OrderFlowPanel } from "@/components/grafik/OrderFlowPanel";
import { AdvancedPositionCard } from "@/components/grafik/AdvancedPositionCard";
import { GuardianPanel } from "@/components/grafik/GuardianPanel";
import { ActivePairMiniCard } from "@/components/grafik/ActivePairMiniCard";
import { DxyMiniCard } from "@/components/grafik/DxyMiniCard";
import { EquityMiniCard } from "@/components/grafik/EquityMiniCard";
import { emaSeries } from "@/lib/indicators/ema";
import { rsiSeries } from "@/lib/indicators/rsi";
import { macdSeries } from "@/lib/indicators/macd";
import { bbSeries } from "@/lib/indicators/bb";
import { vwapSeries } from "@/lib/indicators/vwap";
import { findAllSwingHighs, findAllSwingLows } from "@/lib/sr/swing";
import { toIndicatorCandle, fetchCandles, type Timeframe, type Candle } from "@/lib/okx/candles";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import type { ChartSeries, LinePoint, VolumePoint, ChartMarker, MacdPoint, AlarmLevel, BbBands, VwapBands, SrLevel, TradeLevelLine, DrawnLine } from "@/lib/chart/types";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import { WatchlistPanel, MobileWatchlistView } from "@/components/grafik/WatchlistPanel";
import { PairDropdownMini } from "@/components/grafik/PairDropdownMini";
import { useOkxCandleStream } from "@/lib/ws/useOkxCandleStream";
import { usePriorityFetch } from "@/lib/hooks/usePriorityFetch";

const PriceChart = dynamic(
  () => import("@/components/grafik/PriceChart").then((m) => m.PriceChart),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[480px] rounded border border-border bg-bg-card animate-pulse" />
    ),
  },
);

const VOL_UP = "rgba(34,197,94,0.5)";
const VOL_DOWN = "rgba(239,68,68,0.5)";

const CHART_STORAGE_KEY = "qx_chart_v1";
const VALID_TF = new Set<string>(["5m", "15m", "1h", "4h", "1d"]);

/** Secondary timeframe for split view */
const SEC_TF: Record<Timeframe, Timeframe> = {
  "1d": "4h",
  "4h": "1h",
  "1h": "15m",
  "15m": "5m",
  "5m": "1m",
  "1m": "1m",
};

/** Build ChartSeries from a candle array + overlay flags */
function buildSeries(
  candles: Candle[],
  trades: ReturnType<typeof useTradesStore.getState>["trades"],
  pair: Pair,
  opts: {
    ema20: boolean; ema50: boolean; ema200: boolean; volume: boolean;
    rsi: boolean; macd: boolean; bb: boolean; vwap: boolean; sr: boolean;
    trades: boolean; alarmLevels: AlarmLevel[]; tradeLevels: TradeLevelLine[];
    drawnLines: DrawnLine[];
  },
): ChartSeries {
  const candlePoints = candles.map((c) => ({
    time: Math.floor(c.ts / 1000) as unknown as number,
    open: c.open, high: c.high, low: c.low, close: c.close,
  }));
  const closes = candles.map((c) => c.close);
  const times  = candles.map((c) => Math.floor(c.ts / 1000));

  let ema20: LinePoint[] | undefined;
  let ema50: LinePoint[] | undefined;
  let ema200: LinePoint[] | undefined;

  if (opts.ema20 && candles.length >= 20) {
    const vals = emaSeries(closes, { period: 20 });
    ema20 = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }
  if (opts.ema50 && candles.length >= 50) {
    const vals = emaSeries(closes, { period: 50 });
    ema50 = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }
  if (opts.ema200 && candles.length >= 200) {
    const vals = emaSeries(closes, { period: 200 });
    ema200 = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }

  let volume: VolumePoint[] | undefined;
  if (opts.volume && candles.length > 0) {
    volume = candles.map((c, i) => ({
      time: times[i], value: c.volume,
      color: c.close >= c.open ? VOL_UP : VOL_DOWN,
    }));
  }

  let rsi: LinePoint[] | undefined;
  if (opts.rsi && candles.length >= 15) {
    const vals = rsiSeries(closes, { period: 14 });
    rsi = vals.map((v, i) => v !== null ? { time: times[i], value: v } : null)
      .filter((p): p is LinePoint => p !== null);
  }

  let macdData: MacdPoint[] | undefined;
  if (opts.macd && candles.length >= 35) {
    macdData = macdSeries(closes, times);
  }

  let bbBands: BbBands | undefined;
  if (opts.bb && candles.length >= 20) {
    const bbVals = bbSeries(closes);
    const upper: LinePoint[] = []; const middle: LinePoint[] = []; const lower: LinePoint[] = [];
    bbVals.forEach((v, i) => {
      if (v !== null) {
        upper.push({ time: times[i], value: v.upper });
        middle.push({ time: times[i], value: v.mean });
        lower.push({ time: times[i], value: v.lower });
      }
    });
    if (upper.length > 0) bbBands = { upper, middle, lower };
  }

  let vwapBands: VwapBands | undefined;
  if (opts.vwap && candles.length >= 2) {
    const pts = vwapSeries(
      closes, candles.map(c => c.high), candles.map(c => c.low),
      candles.map(c => c.volume), candles.map(c => c.ts),
    );
    const vwapLine: LinePoint[] = []; const upperLine: LinePoint[] = []; const lowerLine: LinePoint[] = [];
    pts.forEach((v, i) => {
      if (v !== null) {
        vwapLine.push({ time: times[i], value: v.vwap });
        upperLine.push({ time: times[i], value: v.upper });
        lowerLine.push({ time: times[i], value: v.lower });
      }
    });
    if (vwapLine.length > 0) vwapBands = { vwap: vwapLine, upper: upperLine, lower: lowerLine };
  }

  let markers: ChartMarker[] | undefined;
  if (opts.trades) {
    markers = trades
      .filter((t) => t.pair === pair)
      .map((t) => ({
        time: Math.floor(t.openedAt / 1000),
        position: t.direction === "LONG" ? "belowBar" as const : "aboveBar" as const,
        color: t.direction === "LONG" ? "#22c55e" : "#ef4444",
        shape: t.direction === "LONG" ? "arrowUp" as const : "arrowDown" as const,
        text: t.direction,
      }));
  }

  let srLevels: SrLevel[] | undefined;
  if (opts.sr && candles.length >= 7) {
    const indCandles = candles.map(toIndicatorCandle);
    const highs = findAllSwingHighs(indCandles, 60, 3, 8);
    const lows  = findAllSwingLows(indCandles, 60, 3, 8);
    srLevels = [
      ...highs.map((p) => ({ price: p.price, type: "resistance" as const })),
      ...lows.map((p) => ({ price: p.price, type: "support" as const })),
    ];
  }

  return {
    candles: candlePoints, ema20, ema50, ema200, volume, rsi, macdData,
    bb: bbBands, vwap: vwapBands, alarmLevels: opts.alarmLevels,
    markers, srLevels, tradeLevels: opts.tradeLevels,
    drawnLines: opts.drawnLines,
  };
}

export default function GrafikPage() {
  const t = useT();
  const theme           = useSettingsStore((s) => s.theme);
  // KULLANICI KARARI (CI temizlik turu, bkz. sohbet): cyber-terminal
  // şimdilik PriceChart'a "dark" olarak gönderiliyor — PriceChart'ın
  // THEME_COLORS tablosu (components/grafik/PriceChart.tsx) kasıtlı olarak
  // sadece dark/light ayırıyor (grid/text/border renkleri), WatchlistPanel.tsx:670
  // "isDark = theme !== 'light'" ile aynı emsal. Bilinçli olarak ERTELENEN
  // alternatif: cyber-terminal'in kendi chart paleti — bu CI-temizlik
  // turunun kapsamı dışında (yeni özellik, davranış değişikliği), ayrı bir
  // iş olarak backlog'a alınmalı. Bu satırla davranış DEĞİŞMEDİ, sadece
  // önceden tip hatası maskesi altında zaten olan durum dürüstçe ifade
  // edildi.
  const chartTheme: "dark" | "light" = theme === "light" ? "light" : "dark";
  const isOverlayActive = useFocusStore((s) => s.isOverlayActive);
  const clearFocus       = useFocusStore((s) => s.clearFocus);
  // War Room: /karar'dan "→ Chart" ile geldiyse yerel pair state'i focusStore'dan başlat.
  const [pair, setPair]           = useState<Pair>(() => useFocusStore.getState().activeFocusPair ?? "BTC");
  const focusActiveAtMountRef      = useRef(useFocusStore.getState().isOverlayActive);
  usePriorityFetch(pair);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [mobileView, setMobileView] = useState<"list" | "chart">(() =>
    useFocusStore.getState().isOverlayActive ? "chart" : "list",
  );
  const [showEma20, setShowEma20]   = useState(true);
  const [showEma50, setShowEma50]   = useState(true);
  const [showEma200, setShowEma200] = useState(true);
  const [showTrades, setShowTrades] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi]       = useState(false);
  const [showMacd, setShowMacd]     = useState(false);
  const [showBb, setShowBb]         = useState(false);
  const [showVwap, setShowVwap]     = useState(false);
  const [showSr, setShowSr]         = useState(false);

  // New tool state (not persisted — session only)
  const [showSplit, setShowSplit]       = useState(false);
  const [secPair, setSecPair]           = useState<Pair>("ETH");
  const [showFlow, setShowFlow]         = useState(false);
  const [clickMode, setClickMode]       = useState<ChartClickMode>("none");
  const [drawnLines, setDrawnLines]     = useState<DrawnLine[]>([]);
  const [capturedPrice, setCapturedPrice] = useState<number | null>(null);
  const [secCandles, setSecCandles]     = useState<Candle[]>([]);
  const [secLoading, setSecLoading]     = useState(false);

  // Ana chart yüksekliği — /grafik'te header+haber bandı artık gizli olduğu
  // için kazanılan dikey alanı chart'a veriyoruz. PriceChart.tsx'in kendisi
  // sadece genişliği ResizeObserver ile takip ediyor (yükseklik sabit bir
  // number prop) — bu yüzden hesaplamayı burada, çağıran tarafta yapıp
  // mevcut height prop'una geçiriyoruz, PriceChart.tsx'e dokunmuyoruz.
  // CHROME_PX yaklaşık bir değer (back butonu satırı + ChartControls +
  // ChartLegend + BottomNav/safe-area toplamı) — kesin piksel-mükemmel
  // değil, gerekirse görsel test sonrası ayarlanabilir.
  const [primaryChartHeight, setPrimaryChartHeight] = useState(480);
  useEffect(() => {
    const CHROME_PX = 300;
    const MIN_HEIGHT_PX = 320;
    function computeHeight() {
      setPrimaryChartHeight(Math.max(MIN_HEIGHT_PX, window.innerHeight - CHROME_PX));
    }
    computeHeight();
    window.addEventListener("resize", computeHeight);
    return () => window.removeEventListener("resize", computeHeight);
  }, []);

  // Load persisted settings on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHART_STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      // War Room odağı aktifse localStorage'daki eski pair onu ezmesin.
      if (!focusActiveAtMountRef.current && typeof s.pair === "string" && (PAIRS as readonly string[]).includes(s.pair)) setPair(s.pair as Pair);
      if (typeof s.tf === "string" && VALID_TF.has(s.tf)) setTimeframe(s.tf as Timeframe);
      const o = s.o as Record<string, boolean> | undefined;
      if (o) {
        if (o.ema20  !== undefined) setShowEma20(o.ema20);
        if (o.ema50  !== undefined) setShowEma50(o.ema50);
        if (o.ema200 !== undefined) setShowEma200(o.ema200);
        if (o.vol    !== undefined) setShowVolume(o.vol);
        if (o.rsi    !== undefined) setShowRsi(o.rsi);
        if (o.macd   !== undefined) setShowMacd(o.macd);
        if (o.bb     !== undefined) setShowBb(o.bb);
        if (o.vwap   !== undefined) setShowVwap(o.vwap);
        if (o.sr     !== undefined) setShowSr(o.sr);
        if (o.trades !== undefined) setShowTrades(o.trades);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist settings on change
  useEffect(() => {
    try {
      localStorage.setItem(CHART_STORAGE_KEY, JSON.stringify({
        pair, tf: timeframe,
        o: { ema20: showEma20, ema50: showEma50, ema200: showEma200, vol: showVolume,
             rsi: showRsi, macd: showMacd, bb: showBb, vwap: showVwap, sr: showSr, trades: showTrades },
      }));
    } catch { /* ignore */ }
  }, [pair, timeframe, showEma20, showEma50, showEma200, showVolume, showRsi, showMacd, showBb, showVwap, showSr, showTrades]);

  // Intercept OS/browser back button — chart modunda geri = listeye dön
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (!e.state || e.state.mobileView !== "chart") {
        setMobileView("list");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Fetch secondary TF candles when split view is active
  const secTf = SEC_TF[timeframe];
  useEffect(() => {
    if (!showSplit) { setSecCandles([]); return; }
    setSecLoading(true);
    fetchCandles(secPair, secTf, 200)
      .then((data) => { setSecCandles(data ?? []); })
      .catch(() => { setSecCandles([]); })
      .finally(() => { setSecLoading(false); });
  }, [showSplit, secPair, secTf]);

  // Live candle stream — updates last candle via RAF-throttled WS (ADIM 3)
  useOkxCandleStream(pair, timeframe);

  const candlesRaw = useCandleStore((s) => s.candles[`${pair}_${timeframe}`]);
  const candles    = candlesRaw ?? EMPTY_CANDLES;
  const trades     = useTradesStore((s) => s.trades);
  const positions  = usePositionStore((s) => s.positions);
  const alarms     = usePriceAlarmStore((s) => s.alarms);
  const livePrice    = useMarketStore((s) => s.prices[pair]?.last ?? null);
  const secLivePrice = useMarketStore((s) => s.prices[secPair]?.last ?? null);

  const tradeLevels = useMemo<TradeLevelLine[]>(() => {
    const allPos = positions ?? [];

    // Gate: positionStore boşsa erken çıkış — tradesStore "open" dese bile çizgi çizilmez
    const livePos = allPos.filter(
      (p) => p.pair === pair && p.direction !== "NEUTRAL"
    );
    if (livePos.length === 0) return [];

    const lines: TradeLevelLine[] = [];

    for (const pos of livePos) {
      const dir = pos.direction as "LONG" | "SHORT";

      // Entry — kaynak borsa etiketi ile (OKX/BNB/BBT)
      const srcLabel: Record<string, string> = { okx: "OKX", binance: "BNB", bybit: "BBT" };
      const entryLabel = `${srcLabel[pos.source] ?? pos.source} Entry`;
      lines.push({ price: pos.entryPx, kind: "entry", direction: dir, label: entryLabel });

      // tradesStore: yalnızca eksik seviye değerleri için backup
      // Açıklık kararına karışmıyor; livePos guard geçtikten sonra okunuyor
      const appTrade = trades.find(
        (t) => t.status === "open" && t.pair === pair && t.direction === dir
      );

      // SL: OKX algo order birincil; null ise app-side stopPrice değeri
      const sl = pos.slTriggerPx ?? appTrade?.stopPrice ?? null;
      if (sl) lines.push({ price: sl, kind: "sl", direction: dir });

      // TP1: OKX tpTriggerPx birincil; null ise app-side takeProfit1 değeri
      const tp1 = pos.tpTriggerPx ?? appTrade?.takeProfit1 ?? null;
      if (tp1) lines.push({ price: tp1, kind: "tp1", direction: dir });

      // TP2: OKX'te tekil TP — tp2 yalnız app-side'dan
      if (appTrade?.takeProfit2) lines.push({ price: appTrade.takeProfit2, kind: "tp2", direction: dir });
    }

    return lines;
  }, [positions, trades, pair]);

  const alarmLevels = useMemo<AlarmLevel[]>(
    () =>
      alarms
        .filter((a) => a.pair === pair && a.status === "active")
        .map((a) => ({ price: a.targetPrice, condition: a.condition, label: a.label })),
    [alarms, pair],
  );

  // Primary series
  const series = useMemo(() =>
    // EMPTY_CANDLES (candleStore.ts) Object.freeze() ile gerçekten immutable —
    // candles ?? EMPTY_CANDLES union'ı bu yüzden readonly Candle[]'a genişliyor.
    // buildSeries mutable Candle[] bekliyor, [...candles] ile sığ kopya alınıyor.
    buildSeries([...candles], trades, pair, {
      ema20: showEma20, ema50: showEma50, ema200: showEma200,
      volume: showVolume, rsi: showRsi, macd: showMacd, bb: showBb,
      vwap: showVwap, sr: showSr, trades: showTrades,
      alarmLevels, tradeLevels, drawnLines,
    }),
    [candles, trades, pair, showEma20, showEma50, showEma200, showVolume,
     showRsi, showMacd, showBb, showVwap, showSr, showTrades,
     alarmLevels, tradeLevels, drawnLines],
  );

  // Secondary series (split view — EMA200 + volume only, same drawnLines)
  const secSeries = useMemo<ChartSeries | null>(() => {
    if (!showSplit || secCandles.length === 0) return null;
    return buildSeries(secCandles, trades, secPair, {
      ema20: false, ema50: false, ema200: true,
      volume: showVolume, rsi: false, macd: false, bb: false,
      vwap: false, sr: showSr, trades: false,
      alarmLevels: [], tradeLevels, drawnLines,
    });
  }, [showSplit, secCandles, trades, secPair, showVolume, showSr, tradeLevels, drawnLines]);

  // Click handler dispatched to the appropriate mode
  const handlePriceClick = useCallback((price: number) => {
    if (clickMode === "hline") {
      const label = price >= 1000
        ? price.toFixed(0)
        : price >= 1
          ? price.toFixed(2)
          : price.toFixed(4);
      setDrawnLines((prev) => [
        ...prev,
        { id: `dl_${Date.now()}`, price, color: "#f59e0b", label },
      ]);
    } else if (clickMode === "price") {
      setCapturedPrice(price);
    }
  }, [clickMode]);

  const handleSetClickMode = useCallback((mode: ChartClickMode) => {
    setClickMode(mode);
    // Reset captured price when leaving price mode
    if (mode !== "price") setCapturedPrice(null);
  }, []);

  // Format for the captured price display
  function fmtPrice(p: number): string {
    return p >= 1000 ? p.toFixed(2) : p >= 1 ? p.toFixed(4) : p.toFixed(6);
  }

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  /* ── Shared chart column content ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chartSection = useMemo(() => (
    <>
      {/* War Room overlay — /karar'dan "→ Chart" ile odaklanıldığında (C + D).
          NOT: MarketRibbon.tsx artık bu sayfada render edilmiyor — dosya
          SİLİNMEDİ (başka bir yerde yeniden kullanılabilir diye durur),
          BTC/ETH/DXY/EQUITY bilgisi aşağıdaki 4'lü mini kart şeridine
          taşındı. Aktif parite kartı şeritten KALDIRILDI — skoru zaten
          hemen üstteki GuardianPanel'de var, tekrarı gereksizdi. */}
      {isOverlayActive && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => clearFocus()}
            className="shrink-0 rounded border border-border px-2 py-1.5 font-mono text-xs text-text-t3 hover:text-text-t1 hover:border-text-t2 transition-colors"
            title={t("grafik.warRoomClose")}
            aria-label={t("grafik.warRoomClose")}
          >
            ✕
          </button>
        </div>
      )}
      {isOverlayActive && <GuardianPanel pair={pair} />}
      {isOverlayActive && (
        // BTC + ETH (ScoreRingV2+MTF ile) + DXY. EQUITY buradan
        // ChartControls'un zaman dilimi satırına taşındı (şeritte
        // sıkışıp kırpılıyordu, bkz. EquityMiniCard.tsx yorumu) —
        // artık isOverlayActive'e bağlı değil, her zaman görünür.
        <div className="flex gap-2 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <ActivePairMiniCard pair="BTC" />
          <ActivePairMiniCard pair="ETH" />
          <DxyMiniCard />
        </div>
      )}

      <ChartControls
        timeframe={timeframe}
        showEma20={showEma20}
        showEma50={showEma50}
        showEma200={showEma200}
        showTrades={showTrades}
        showVolume={showVolume}
        showRsi={showRsi}
        showMacd={showMacd}
        showBb={showBb}
        showVwap={showVwap}
        showSr={showSr}
        showSplit={showSplit}
        clickMode={clickMode}
        onTimeframeChange={setTimeframe}
        onToggleEma20={() => setShowEma20((v) => !v)}
        onToggleEma50={() => setShowEma50((v) => !v)}
        onToggleEma200={() => setShowEma200((v) => !v)}
        onToggleTrades={() => setShowTrades((v) => !v)}
        onToggleVolume={() => setShowVolume((v) => !v)}
        onToggleRsi={() => setShowRsi((v) => !v)}
        onToggleMacd={() => setShowMacd((v) => !v)}
        onToggleBb={() => setShowBb((v) => !v)}
        onToggleVwap={() => setShowVwap((v) => !v)}
        onToggleSr={() => setShowSr((v) => !v)}
        onToggleSplit={() => setShowSplit((v) => !v)}
        showFlow={showFlow}
        onToggleFlow={() => setShowFlow((v) => !v)}
        onSetClickMode={handleSetClickMode}
        rightSlot={<EquityMiniCard />}
      />

      <ChartLegend
        showEma20={showEma20}
        showEma50={showEma50}
        showEma200={showEma200}
        showTrades={showTrades}
        showVolume={showVolume}
        showRsi={showRsi}
        showMacd={showMacd}
        showBb={showBb}
        showVwap={showVwap}
        showSr={showSr}
      />

      {/* PositionOverlayBar buradan kaldırıldı — AdvancedPositionCard geri
          geldiği için (chart canvas'ının içinde, LONG/SHORT + PnL $/% +
          Entry/Liq/Size + kaldıraç hepsini gösteriyor) bu üst şerit aynı
          bilgiyi tekrar ediyordu. Component dosyası SİLİNMEDİ, sadece bu
          sayfadaki kullanımı kaldırıldı. Kendi root div'inin dış margin'i
          yoktu (sadece iç px-3 py-2), bu yüzden kaldırılması boşta kalan
          bir margin/gap bırakmıyor — ChartLegend ile altındaki blok arası
          boşluk, ikisinin kendi (değişmeyen) spacing'iyle aynı kalıyor. */}

      {/* Active mode indicator + drawn lines count */}
      {(clickMode !== "none" || drawnLines.length > 0) && (
        <div className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-mono ${
          clickMode !== "none"
            ? clickMode === "hline"
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
              : "border-green-500/40 bg-green-500/10 text-green-400"
            : "border-border/50 bg-surface-2/50 text-text-t3"
        }`}>
          {clickMode !== "none" && (
            <>
              <span className="animate-pulse">●</span>
              <span>{clickMode === "hline" ? t("grafik.drawHline") : t("grafik.drawPrice")}</span>
              <button
                onClick={() => handleSetClickMode("none")}
                className="min-h-[40px] px-2 flex items-center opacity-60 hover:opacity-100"
              >
                {t("grafik.drawCancelAll")}
              </button>
            </>
          )}
          {drawnLines.length > 0 && (
            <>
              {clickMode !== "none" && <div className="w-px h-3.5 bg-current/20 mx-1 shrink-0" />}
              <span className="font-mono text-[10px] tabular-nums">
                {drawnLines.length} {t("grafik.drawnLinesLabel")}
              </span>
              <button
                onClick={() => setDrawnLines([])}
                className="ml-auto shrink-0 font-mono text-[10px] min-h-[40px] px-2 flex items-center opacity-60 hover:opacity-100 hover:text-red-400"
                title={t("grafik.clearLines")}
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}

      {/* Captured price panel */}
      {clickMode === "price" && capturedPrice !== null && (
        <div className="flex items-center gap-3 rounded border border-green-500/40 bg-green-500/10 px-3 py-2">
          <span className="font-mono text-xs text-text-t3">{t("grafik.priceCaptureLabel")}</span>
          <span className="font-mono text-sm font-bold text-green-400">
            ${fmtPrice(capturedPrice)}
          </span>
          <div className="flex gap-1 ml-2">
            {(["Entry", "TP1", "TP2", "SL"] as const).map((label) => (
              <button
                key={label}
                onClick={() => void copyToClipboard(fmtPrice(capturedPrice))}
                className={`rounded border px-2 py-2 font-mono text-2xs tracking-wider transition-colors ${
                  label === "SL"
                    ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                    : label.startsWith("TP")
                      ? "border-green-500/40 text-green-400 hover:bg-green-500/10"
                      : "border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                }`}
                title={t("grafik.priceCopyAs", { label })}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto font-mono text-2xs text-text-t4">
            {t("grafik.priceCaptureCopied")}
          </span>
          <button
            onClick={() => setCapturedPrice(null)}
            className="text-text-t4 hover:text-text-t2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chart grid — single or split */}
      <div className={`flex gap-3 ${showSplit ? "flex-col md:flex-row" : "flex-col"}`}>
        {/* Primary chart */}
        <div className={showSplit ? "flex-1 min-w-0" : "w-full"}>
          {showSplit && (
            <div className="mb-1 flex items-center gap-1.5">
              <PairDropdownMini value={pair} onChange={setPair} />
              <span className="font-mono text-2xs text-text-t4 uppercase tracking-wider">
                · {timeframe.toUpperCase()}
              </span>
            </div>
          )}
          <div className="relative">
            <PriceChart
                series={series}
                height={showSplit ? 360 : primaryChartHeight}
                theme={chartTheme}
                onChartClick={handlePriceClick}
                resetKey={`${pair}_${timeframe}`}
                currentPrice={livePrice ?? undefined}
              />
            {/* AdvancedPositionCard — bilinçli olarak eski konumuna (chart
                canvas'ının İÇİNDE, absolute) döndürüldü. Bir önceki turda
                canvas'ın dışına, grafiğin altına taşınmıştı (yapısal olarak
                mumlarla asla çakışmayan bir çözümdü) — o karardan bilerek
                vazgeçildi: mumlarla zaman zaman çakışması kabul edilen bir
                ödün, "boş köşe" heuristiğine tekrar dönülmüyor, sabit
                top-2 + left-2 yeterli görüldü. left-2 (sol üst) — ilk
                denemede "fiyat eksenine yakın" ifadesinden right-16
                seçilmişti, sonra sol üst olarak netleştirildi (en son
                denenen top-left konumu). max-w-[85%] aynı CSS gerekçeyle
                (wrapper'ın containing block'u definite genişlikte) korundu.
                PositionOverlayBar hiç dokunulmadan üstte kaldı. */}
            {isOverlayActive && (
              <div className="absolute top-2 left-2 max-w-[85%] pointer-events-none">
                <AdvancedPositionCard pair={pair} />
              </div>
            )}
          </div>
        </div>

        {/* Secondary chart (split view) */}
        {showSplit && (
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <PairDropdownMini value={secPair} onChange={setSecPair} />
              <span className="font-mono text-2xs text-text-t4 uppercase tracking-wider">
                · {secTf.toUpperCase()}
              </span>
              {secLoading && <span className="font-mono text-2xs text-text-t4 opacity-50">…</span>}
            </div>
            {secSeries ? (
              <PriceChart
                  series={secSeries}
                  height={360}
                  theme={chartTheme}
                  onChartClick={handlePriceClick}
                  resetKey={`${secPair}_${secTf}`}
                  currentPrice={secLivePrice ?? undefined}
                />
            ) : (
              <div className="flex items-center justify-center h-[360px] rounded border border-border bg-bg-card">
                <span className="font-mono text-2xs text-text-t4">
                  {secLoading ? t("grafik.loading") : t("grafik.empty")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Flow Panel */}
      {showFlow && <OrderFlowPanel pair={pair} />}

      {/* Drawn lines list */}
      {drawnLines.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {drawnLines.map((dl) => (
            <div
              key={dl.id}
              className="flex items-center gap-1.5 rounded border border-border px-2 py-0.5"
              style={{ borderColor: dl.color + "60" }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: dl.color }}
              />
              <span className="font-mono text-2xs text-text-t2">${dl.label}</span>
              <button
                onClick={() => setDrawnLines((prev) => prev.filter((l) => l.id !== dl.id))}
                className="font-mono text-2xs text-text-t4 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  ), [
    timeframe, showEma20, showEma50, showEma200, showTrades, showVolume,
    showRsi, showMacd, showBb, showVwap, showSr, showSplit, showFlow,
    clickMode, drawnLines, capturedPrice, secLoading, secSeries, series,
    pair, secPair, secTf, theme, t, handleSetClickMode, handlePriceClick,
    isOverlayActive, clearFocus,
  ]);

  return (
    <>
      {/* ── Mobil: iki durumlu navigasyon ── */}
      <div className="md:hidden flex flex-col">
        {mobileView === "list" ? (
          <MobileWatchlistView
            activePair={pair}
            onPairSelect={(p) => {
              setPair(p);
              setMobileView("chart");
              // history entry → OS geri tuşu listeye döner, karar sayfasına değil
              window.history.pushState({ mobileView: "chart" }, "");
            }}
          />
        ) : (
          <div className="flex flex-col gap-1 px-0 py-3">
            {/* Geri butonu + pair adı — kendi px-3'ünü taşıyor, parent'ın
                px-0 olması sadece chartSection'ın (kendi iç padding'i olan
                PositionOverlayBar/ChartControls) tam genişlik almasını
                sağlıyor, bu satırı etkilemiyor. gap-2→gap-1: başlık ile
                (War Room aktifken) hemen altındaki GuardianPanel arası
                dikey boşluk yarıya indirildi. */}
            <div className="flex items-center gap-3 px-3">
              <button
                onClick={() => { setMobileView("list"); window.history.back(); }}
                className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-xs text-text-t3 hover:text-text-t1 hover:border-text-t2 transition-colors"
              >
                {t("grafik.mobileBack")}
              </button>
              <PairDropdownMini value={pair} onChange={setPair} size="lg" />
              <span className="font-mono text-sm font-bold text-text-t1 opacity-50">· USDT</span>
            </div>
            {chartSection}
          </div>
        )}
      </div>

      {/* ── Masaüstü: yan yana layout ── */}
      <div className="hidden md:flex gap-3 items-start">
        <WatchlistPanel activePair={pair} onPairChange={setPair} />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {chartSection}
        </div>
      </div>
    </>
  );
}
