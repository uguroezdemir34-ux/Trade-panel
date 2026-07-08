"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useMacroStore } from "@/lib/store/macroStore";
import { computeOiDivergence } from "@/lib/market/oi-divergence";
import { computeMtfTrend } from "@/lib/market/mtfTrend";
import type { MtfTrendResult } from "@/lib/market/mtfTrend";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useWatchlistStore } from "@/lib/store/watchlistStore";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatTickPrice } from "@/lib/i18n/format";

function fmtCompact(v: number): string {
  if (v >= 1e12)  return `${(v / 1e12).toFixed(2)}T`;
  if (v >= 100e9) return `${Math.round(v / 1e9)}B`;
  if (v >= 1e9)   return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 100e6) return `${Math.round(v / 1e6)}M`;
  if (v >= 1e6)   return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3)   return `${Math.round(v / 1e3)}K`;
  return v.toFixed(0);
}

function activeBorderClass(s: number | undefined): string {
  if (s === undefined) return "border-white/20";
  if (s >= 80) return "border-teal-400/60";
  if (s >= 60) return "border-blue-400/60";
  if (s >= 40) return "border-amber-400/60";
  if (s >= 30) return "border-purple-400/60";
  return "border-red-400/40";
}

/* Skor hızı pencereleri — snapshot cadence'i ~15dk (candle kapanışına bağlı) olduğu için
   5dk gibi daha kısa bir pencere sahte hassasiyet verir, o yüzden desteklenmiyor. */
const MOMENTUM_WINDOW_MIN = 15;
const DELTA_BADGE_WINDOW_MIN = 30;

const PAIR_GROUPS: Record<string, readonly Pair[]> = {
  all:    PAIRS,
  majors: ["BTC", "ETH", "BNB", "XRP", "SOL", "APT"],
  alts:   ["ADA", "AVAX", "LINK", "NEAR", "SUI", "TAO", "PENDLE", "OP", "HYPE", "ONDO", "TIA", "JUP", "ENA", "SEI"],
  meme:   ["DOGE", "SHIB", "WIF"],
};
type PairGroup = "all" | "majors" | "alts" | "meme" | "go" | "watch" | "act";
import { VerdictBadge } from "@/components/karar/VerdictBadge";
import { ScoreGauge } from "@/components/karar/ScoreGauge";
import { PAIR_CATEGORY } from "@/lib/constants/pairMeta";
import { ScoreBreakdown } from "@/components/karar/ScoreBreakdown";
import { BlocksList } from "@/components/karar/BlocksList";
import { ReasonsList } from "@/components/karar/ReasonsList";
import { DirectionBadge } from "@/components/karar/DirectionBadge";
import { FlowAlignmentRow } from "@/components/karar/FlowAlignmentRow";
import { PositionSizer } from "@/components/karar/PositionSizer";
import { TradeConfirmModal } from "@/components/karar/TradeConfirmModal";
import { computePositionSize } from "@/lib/sizer/position";
import { atr } from "@/lib/indicators/atr";
import { adx } from "@/lib/indicators/adx";
import { ema } from "@/lib/indicators/ema";
import { rsi as rsiIndicator } from "@/lib/indicators/rsi";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { findSwingLevels } from "@/lib/sr/swing";
import type { PositionSizerResult } from "@/lib/sizer/types";
import { useFlowIntelligence } from "@/lib/hooks/useFlowIntelligence";
import { formatCvd } from "@/lib/orderflow/cvd";
import { getBucketStats } from "@/lib/bucket/stats";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { computeScoreVelocity } from "@/lib/score/velocity";
import { computeHoldExitGuide, HOLD_EXIT_LABEL_TEXT } from "@/lib/score/holdExitGuide";
import { SessionStatsBar } from "@/components/karar/SessionStatsBar";
import { QuickAlarm } from "@/components/karar/QuickAlarm";
import { StreakBanner } from "@/components/karar/StreakBanner";
import { LiveEdgeBadge } from "@/components/karar/LiveEdgeBadge";
import { KeyboardShortcutsModal } from "@/components/karar/KeyboardShortcutsModal";
import { HistoricalEdge } from "@/components/karar/HistoricalEdge";
import { CorrelationWarning } from "@/components/karar/CorrelationWarning";
import { CandlePatternBadge } from "@/components/karar/CandlePatternBadge";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import { RegimeBadge } from "@/components/karar/RegimeBadge";
import { usePairNotesStore } from "@/lib/store/pairNotesStore";
import { PairSignalHistory } from "@/components/karar/PairSignalHistory";
import { PairTradeStats } from "@/components/karar/PairTradeStats";
import { WalletSummaryBar } from "@/components/karar/WalletSummaryBar";
import { usePriorityFetch } from "@/lib/hooks/usePriorityFetch";
import { CoinIcon } from "@/components/karar/CoinIcon";
import { ScoreRingV2 } from "@/components/karar/ScoreRingV2";
import { MarketPulseWidget } from "@/components/karar/MarketPulseWidget";
import { SignalAccuracyCard } from "@/components/karar/SignalAccuracyCard";
import { MissedSignalsBanner } from "@/components/karar/MissedSignalsBanner";
import { PositionAccordion } from "@/components/karar/PositionAccordion";

export default function KararPage() {
  const t = useT();
  const locale = useLocale();
  const [activePair, setActivePair] = useState<Pair>("BTC");
  const [isStale,     setIsStale]     = useState(false);
  const [staleFailed, setStaleFailed] = useState(false);

  useEffect(() => { setIsStale(false); setStaleFailed(false); }, [activePair]);

  // [QX PERF] teşhis — production'a gitmeyecek
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as { __qx_nav_ts?: number };
    const navTs = w.__qx_nav_ts;
    const mountDelta = navTs ? Math.round(performance.now() - navTs) : null;
    console.log(`[QX PERF] karar:mount ${mountDelta != null ? `+${mountDelta}ms` : "(cold)"}`);
  }, []);

  usePriorityFetch(
    activePair,
    (success) => { setIsStale(false); if (!success) setStaleFailed(true); },
    ()        => { setIsStale(true);  setStaleFailed(false); },
  );
  const [pairGroup, setPairGroup] = useState<PairGroup>("all");
  const [sortByScore, setSortByScore] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const watchlistPairs = useWatchlistStore((s) => s.pairs);
  const watchlistToggle = useWatchlistStore((s) => s.toggle);
  const watchlistLoad = useWatchlistStore((s) => s.load);

  useEffect(() => { watchlistLoad(); }, [watchlistLoad]);

  // Geçici debug — ?debug=1 query param'ı varsa Eruda mobil konsol yükle
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("debug=1")) {
      import("eruda").then((eruda) => eruda.default.init());
    }
  }, []);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [showTrend, setShowTrend] = useState(false);
  const [showHacim, setShowHacim] = useState(false);
  const [showMomentum, setShowMomentum] = useState(false);
  const [showDivergence, setShowDivergence] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showMarketPulse, setShowMarketPulse] = useState(true);

  // BTC card — score-change pulse (single-shot, no continuous animation)
  const btcPrevScoreRef  = useRef<number | undefined>(undefined);
  const btcPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [btcPulseActive, setBtcPulseActive] = useState(false);

  const result = useScoreStore((s) => s.results[activePair]);
  const allResults = useScoreStore((s) => s.results);
  const computedAt = useScoreStore((s) => s.computedAt);
  const computing = useScoreStore((s) => s.computing);
  const scoreHistory = useScoreHistoryStore((s) => s.history);
  const candles1hRaw = useCandleStore((s) => s.candles[`${activePair}_1h`]);
  const candles4hRaw = useCandleStore((s) => s.candles[`${activePair}_4h`]);
  const candles1h = candles1hRaw ?? EMPTY_CANDLES;
  const candles4h = candles4hRaw ?? EMPTY_CANDLES;
  const candles15mRaw = useCandleStore((s) => s.candles[`${activePair}_15m`]);
  const candles15m = candles15mRaw ?? EMPTY_CANDLES;
  const livePrice = useMarketStore((s) => s.prices[activePair]?.last ?? null);
  const allTicks = useMarketStore((s) => s.prices);
  const balanceTotal = useAccountStore((s) => s.balanceTotal);
  const balanceFree = useAccountStore((s) => s.balanceFree);
  const drawdownProtocol = useAccountStore((s) => s.drawdownProtocol);
  const forwardTestMode = useSettingsStore((s) => s.forwardTestMode);
  const logEvent = useRiskStore((s) => s.logEvent);
  const trades = useTradesStore((s) => s.trades);
  const openPending = useTradesStore((s) => s.openPending);
  const openPositions = usePositionStore((s) => s.positions);
  const funding = useMacroStore((s) => s.funding);
  const fgValue = useMacroStore((s) => s.fgValue);
  const marketCap = useMacroStore((s) => s.marketCap);
  const oiVelocityForPair = useMacroStore((s) => s.oiVelocity[activePair] ?? null);

  const handleCloseMarketPulse = useCallback(() => setShowMarketPulse(false), []);

  const snapScoresByPair = useMemo(() => {
    const out: Partial<Record<string, number[]>> = {};
    for (const p of PAIRS) {
      out[p] = (scoreHistory[p] ?? [])
        .filter((s) => typeof s.score === "number" && isFinite(s.score))
        .map((s) => s.score);
    }
    return out;
  }, [scoreHistory]);

  // MTF trend data for the pair grid — smart equality so only 1h/4h/1d candle closes trigger recompute
  const allCandlesForMtf = useCandleStore(
    (s) => s.candles,
    (prev, next) => {
      for (const pair of PAIRS) {
        for (const tf of ["1h", "4h", "1d"] as const) {
          const key = `${pair}_${tf}` as const;
          const p = prev[key];
          const n = next[key];
          if (p === n) continue;
          if (!p || !n || p.length !== n.length) return false;
          const pLast = p[p.length - 1];
          const nLast = n[n.length - 1];
          if (!pLast || !nLast) return false;
          if (pLast.ts !== nLast.ts || pLast.confirm !== nLast.confirm) return false;
        }
      }
      return true;
    },
  );

  const mtfResults = useMemo(() => {
    const out: Partial<Record<Pair, MtfTrendResult>> = {};
    for (const pair of PAIRS) {
      const c1h = allCandlesForMtf[`${pair}_1h`] ?? EMPTY_CANDLES;
      const c4h = allCandlesForMtf[`${pair}_4h`] ?? EMPTY_CANDLES;
      const c1d = allCandlesForMtf[`${pair}_1d`] ?? EMPTY_CANDLES;
      if (c1h.length >= 20) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        out[pair] = computeMtfTrend(pair, c1h as any, c4h as any, c1d as any);
      }
    }
    return out;
  }, [allCandlesForMtf]);

  // Keyboard shortcuts: 1-9 / [ ] / G / ?
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;

      // ? → toggle shortcuts modal
      if (e.key === "?") {
        setShowShortcuts((v) => !v);
        return;
      }

      // 1-9 → jump to pair by index
      const digit = parseInt(e.key);
      if (!isNaN(digit) && digit >= 1 && digit <= 9) {
        const target = PAIRS[digit - 1];
        if (target) setActivePair(target);
        return;
      }

      // [ / ] → previous / next pair in current display list
      if (e.key === "[" || e.key === "]") {
        const list = displayPairsRef.current;
        if (list.length === 0) return;
        const idx = list.indexOf(activePair);
        const next =
          e.key === "]"
            ? list[(idx + 1) % list.length]
            : list[(idx - 1 + list.length) % list.length];
        setActivePair(next);
        return;
      }

      // G → cycle through GO pairs
      if (e.key === "g" || e.key === "G") {
        const goList = PAIRS.filter((p) => allResults[p]?.verdict === "go");
        if (goList.length === 0) return;
        const currentIdx = goList.indexOf(activePair);
        setActivePair(goList[(currentIdx + 1) % goList.length]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [allResults, activePair]);

  // BTC pulse — fires once when BTC score value changes
  const btcScoreForPulse = allResults["BTC"]?.score;
  useEffect(() => {
    if (btcScoreForPulse === undefined) return;
    if (btcPrevScoreRef.current !== undefined && btcPrevScoreRef.current !== btcScoreForPulse) {
      if (btcPulseTimerRef.current) clearTimeout(btcPulseTimerRef.current);
      setBtcPulseActive(true);
      btcPulseTimerRef.current = setTimeout(() => {
        setBtcPulseActive(false);
        btcPulseTimerRef.current = null;
      }, 700);
    }
    btcPrevScoreRef.current = btcScoreForPulse;
  }, [btcScoreForPulse]);

  const goPairs = useMemo(
    () => PAIRS.filter((p) => allResults[p]?.verdict === "go"),
    [allResults],
  );

  // GO pairs where no open position exists — immediately actionable signals
  const actionablePairs = useMemo(() => {
    const openPairSet = new Set(openPositions.map((p) => p.pair));
    return goPairs.filter((p) => !openPairSet.has(p));
  }, [goPairs, openPositions]);

  // Open position + matching trade for the currently selected pair
  const activePosition = useMemo(
    () => openPositions.find((p) => p.pair === activePair) ?? null,
    [openPositions, activePair],
  );
  const activeTrade = useMemo(
    () =>
      activePosition
        ? trades
            .filter((t) => t.pair === activePair && t.status === "open")
            .sort((a, b) => b.openedAt - a.openedAt)[0] ?? null
        : null,
    [activePosition, trades, activePair],
  );

  const alarms = usePriceAlarmStore((s) => s.alarms);
  const alarmedPairs = useMemo(
    () => new Set(alarms.filter((a) => a.status === "active").map((a) => a.pair)),
    [alarms],
  );

  const pairNotes = usePairNotesStore((s) => s.notes);
  const setPairNote = usePairNotesStore((s) => s.setNote);
  const clearPairNote = usePairNotesStore((s) => s.clearNote);

  const displayPairs = useMemo<readonly Pair[]>(() => {
    let base: readonly Pair[];
    if (pairGroup === "go") base = goPairs.length > 0 ? goPairs : PAIRS;
    else if (pairGroup === "watch") base = watchlistPairs.length > 0 ? watchlistPairs : PAIRS;
    else if (pairGroup === "act") base = actionablePairs.length > 0 ? actionablePairs : PAIRS;
    else base = PAIR_GROUPS[pairGroup] ?? PAIRS;
    if (!sortByScore) return base;
    return [...base].sort((a, b) => (allResults[b]?.score ?? 0) - (allResults[a]?.score ?? 0));
  }, [pairGroup, goPairs, watchlistPairs, actionablePairs, sortByScore, allResults]);

  // Ref so the keydown handler always sees the latest displayPairs without re-binding
  const displayPairsRef = useRef<readonly Pair[]>(displayPairs);
  displayPairsRef.current = displayPairs;

  /* 15dk zaman-penceresi bazlı skor hızı — snapshot sayısı değil, ts farkına göre */
  const pairMomentum = useMemo<Partial<Record<Pair, number>>>(() => {
    try {
      const out: Partial<Record<Pair, number>> = {};
      for (const p of PAIRS) {
        const v = computeScoreVelocity(scoreHistory[p], MOMENTUM_WINDOW_MIN);
        if (v) out[p] = v.delta;
      }
      return out;
    } catch { return {}; }
  }, [scoreHistory]);

  /* TEMP DEBUG — velocity badge tanılama, iş bitince kaldırılacak.
     scoreHistory değiştiğinde (yani ~15dk cadence'te) bir kez loglar, per-render/per-tick değil.
     resultState ayrımı: "undefined" = useScoreEngine'in try/catch'i sessizce yuttu (gerçek bug),
     "null(skipped)" = composeScoreInput meşru şekilde null döndü (candle/fiyat eksik, setSkipped çalıştı),
     "ok" = skor normal hesaplandı ama yine de history büyümüyorsa ayrı bir sorun var demektir.
     candles1h/candles4h: candleStore.getState() ile snapshot okunuyor (yeni subscription açmıyor,
     ekstra re-render tetiklemiyor) — composeScoreInput'un 200 eşiğiyle karşılaştırmak için. */
  useEffect(() => {
    const candles = useCandleStore.getState().candles;
    for (const p of PAIRS) {
      const snaps = scoreHistory[p] ?? [];
      const n = snaps.length;
      const gapMin = n >= 2 ? Math.round((snaps[n - 1].ts - snaps[n - 2].ts) / 60_000) : null;
      const r = allResults[p];
      const resultState = r === undefined ? "undefined" : r === null ? "null(skipped)" : `ok(score=${r.score})`;
      const c1h = candles[`${p}_1h`]?.length ?? 0;
      const c4h = candles[`${p}_4h`]?.length ?? 0;
      // eslint-disable-next-line no-console
      console.log(`[velocity-debug] ${p}: snapshots=${n} lastGap=${gapMin === null ? "n/a" : `${gapMin}dk`} resultState=${resultState} candles1h=${c1h} candles4h=${c4h}`);
    }
  }, [scoreHistory, allResults]);

  const latestScoreTime = useMemo(() => {
    const times = Object.values(computedAt).filter((v): v is number => v !== undefined);
    return times.length > 0 ? Math.max(...times) : null;
  }, [computedAt]);

  const bucketStats = useMemo(() => {
    if (!result) return null;
    const closedTrades = trades
      .filter((tr) => tr.status === "closed" && tr.exit != null && tr.pair === activePair)
      .map((tr) => ({ score: tr.entryContext.score, pnlUsd: tr.exit!.pnlUsd }));
    return getBucketStats(result.score, closedTrades);
  }, [result, trades, activePair]);

  const signalDir: "LONG" | "SHORT" =
    result?.direction === "SHORT" ? "SHORT" : "LONG";

  const oiDivergence = computeOiDivergence(oiVelocityForPair, result?.direction ?? "NEUTRAL");

  const flowResult = useFlowIntelligence(activePair, signalDir);

  const flowDir: "up" | "down" | "neutral" = flowResult
    ? flowResult.vetoed || flowResult.totalAdjustment < 0
      ? "down"
      : flowResult.totalAdjustment > 0
      ? "up"
      : "neutral"
    : "neutral";

  const prevPairRef = useRef<string>("");
  const prevFlowDirRef = useRef<"up" | "down" | "neutral" | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [flowPulseClass, setFlowPulseClass] = useState("");

  useEffect(() => {
    const cancelTimer = () => {
      if (pulseTimerRef.current !== null) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };

    // First render or pair switch: initialize without pulsing
    if (prevFlowDirRef.current === null || activePair !== prevPairRef.current) {
      prevPairRef.current = activePair;
      prevFlowDirRef.current = flowDir;
      setFlowPulseClass("");
      cancelTimer();
      return cancelTimer;
    }

    const prevDir = prevFlowDirRef.current;
    prevFlowDirRef.current = flowDir;

    if (flowDir === prevDir) return cancelTimer;

    // Direction changed — trigger one-shot pulse
    cancelTimer();
    const cls = flowDir === "up" ? "flow-pulse-up" : flowDir === "down" ? "flow-pulse-down" : "";
    setFlowPulseClass(cls);
    if (cls) {
      pulseTimerRef.current = setTimeout(() => {
        setFlowPulseClass("");
        pulseTimerRef.current = null;
      }, 1500);
    }

    return cancelTimer;
  }, [activePair, flowDir]);

  const atrValue = useMemo(() => {
    try {
      if (candles1h.length < 15) return null;
      return atr(candles1h.map(toIndicatorCandle), { period: 14 });
    } catch { return null; }
  }, [candles1h]);

  const adxValue = useMemo(() => {
    try {
      if (candles1h.length < 29) return null;
      return adx(candles1h.map(toIndicatorCandle), 14)?.adx ?? null;
    } catch { return null; }
  }, [candles1h]);

  const rsiValue = useMemo(() => {
    try {
      if (candles1h.length < 15) return null;
      return rsiIndicator(candles1h.map((c) => c.close), { period: 14 });
    } catch { return null; }
  }, [candles1h]);

  const ema200_4h = useMemo(() => {
    try {
      return candles4h.length >= 200 ? ema(candles4h.map((c) => c.close), { period: 200 }) : null;
    } catch { return null; }
  }, [candles4h]);

  const ema200_1h = useMemo(() => {
    try {
      return candles1h.length >= 200 ? ema(candles1h.map((c) => c.close), { period: 200 }) : null;
    } catch { return null; }
  }, [candles1h]);

  const ema200_15m = useMemo(() => {
    try {
      return candles15m.length >= 200 ? ema(candles15m.map((c) => c.close), { period: 200 }) : null;
    } catch { return null; }
  }, [candles15m]);

  const swingLevels = useMemo(() => {
    try {
      const sw4h =
        candles4h.length >= 10
          ? findSwingLevels(candles4h.map(toIndicatorCandle), 20, 2)
          : { swingLow: null, swingHigh: null };
      const sw1h =
        candles1h.length >= 10
          ? findSwingLevels(candles1h.map(toIndicatorCandle), 30, 2)
          : { swingLow: null, swingHigh: null };
      return {
        swingLow: sw4h.swingLow ?? sw1h.swingLow,
        swingHigh: sw4h.swingHigh ?? sw1h.swingHigh,
      };
    } catch { return { swingLow: null, swingHigh: null }; }
  }, [candles1h, candles4h]);

  const sizerResult = useMemo<PositionSizerResult | null>(() => {
    if (!result || result.verdict !== "go") return null;
    if (!livePrice || !atrValue) return null;
    if (result.direction !== "LONG" && result.direction !== "SHORT") return null;

    return computePositionSize({
      pair: activePair,
      direction: result.direction,
      px: livePrice,
      atr: atrValue,
      adx1h: adxValue,
      swingLow: swingLevels.swingLow,
      swingHigh: swingLevels.swingHigh,
      balance: {
        total: balanceTotal,
        free: balanceFree,
      },
      drawdownProtocol: {
        tier: drawdownProtocol.tier,
        multiplier: drawdownProtocol.multiplier,
        label: drawdownProtocol.label,
      },
      bucket: bucketStats ?? {
        n: 0,
        wr: null,
        isCut: false,
        isBoost: false,
        hasData: false,
        min: 0,
        max: 0,
      },
      score: result.score,
    });
  }, [result, livePrice, atrValue, adxValue, swingLevels, activePair, balanceTotal, balanceFree, drawdownProtocol]);

  async function handleConfirm(_marginMode: "cross" | "isolated" = "cross") {
    if (!sizerResult || !result || !livePrice) return;
    if (result.direction !== "LONG" && result.direction !== "SHORT") return;

    setIsExecuting(true);
    setExecError(null);

    const fundingResult = funding[activePair] ?? null;

    if (forwardTestMode) {
      openPending({
        pair: activePair,
        direction: result.direction,
        entryPrice: livePrice,
        qty: sizerResult.qty,
        leverage: sizerResult.leverage,
        stopPrice: sizerResult.stop.stopPrice,
        takeProfit1: sizerResult.tp.tp1Price,
        takeProfit2: sizerResult.tp.tp2Price,
        riskAmountUsd: sizerResult.risk.riskUsd,
        isPaper: true,
        entryContext: {
          score: result.score,
          verdict: result.verdict,
          fgValue: fgValue ?? undefined,
          fundingRate: fundingResult?.fundingRate ?? undefined,
          drawdownTier: drawdownProtocol.tier,
        },
      });
      logEvent("trade_open", {
        pair: activePair,
        direction: result.direction,
        score: result.score,
        decision: "go",
        source: "manual",
        reason: "forward_test",
      });
      setShowConfirm(false);
      setIsExecuting(false);
      return;
    }

    setExecError(t("karar.execForwardTestRequired"));
    setIsExecuting(false);
  }

  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      {/* Forward Test Mode banner */}
      {forwardTestMode && (
        <div className="flex items-center gap-2 rounded-lg border border-signal-green/30 bg-signal-green/8 px-3 py-2">
          <span className="font-mono text-xs font-bold tracking-widest text-signal-green">
            FWD TEST
          </span>
          <span className="text-text-t2 font-mono text-xs">
            {t("karar.fwdTestActive")}
          </span>
        </div>
      )}

      <PositionAccordion />

      <MissedSignalsBanner />

      <WalletSummaryBar />

      <StreakBanner />

      <SessionStatsBar />

      <SignalAccuracyCard />

      {/* Header row: MarketPulseWidget + keyboard shortcut */}
      <div className="flex items-center justify-between -mt-1">
        {showMarketPulse && (
          <MarketPulseWidget onClose={handleCloseMarketPulse} />
        )}
        <div className={showMarketPulse ? "" : "ml-auto"}>
          <button
            onClick={() => setShowShortcuts(true)}
            className="font-mono text-2xs text-text-t4 hover:text-text-t2 transition-colors border border-border/40 rounded px-2 py-0.5"
            title={t("karar.keyboardShortcutHint")}
          >
            ⌨ ?
          </button>
        </div>
      </div>

      {/* Desktop 2-column layout */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">

        {/* LEFT SIDEBAR — pair selection */}
        <div className="flex flex-col gap-3 lg:w-72 lg:shrink-0 order-2 lg:order-1">
          {/* Score freshness */}
          <div className="flex items-center justify-between">
            <span translate="no" className="text-text-t4 font-mono text-2xs tracking-wider">
              {latestScoreTime !== null
                ? `${t("karar.scoresUpdated")} · ${scoreAge(latestScoreTime)} ${t("karar.scoresAgo")}`
                : t("karar.scoresNever")}
            </span>
            {computing && (
              <span className="text-brand font-mono text-2xs animate-pulse">⟳</span>
            )}
          </div>

          {/* Pair grid */}
          <div className="flex flex-col gap-2">

          {/* Pair group filter */}
          <div className="flex flex-wrap gap-1">
            {(["all", "majors", "alts", "meme", "go", "act", "watch"] as PairGroup[]).map((g) => {
              const label =
                g === "all" ? t("karar.groupAll") :
                g === "majors" ? "Majors" :
                g === "alts" ? "Alts" :
                g === "meme" ? "Meme" :
                g === "watch" ? `⭐${watchlistPairs.length > 0 ? ` (${watchlistPairs.length})` : ""}` :
                g === "act" ? `ACT${actionablePairs.length > 0 ? ` (${actionablePairs.length})` : ""}` :
                `GO${goPairs.length > 0 ? ` (${goPairs.length})` : ""}`;
              const isActive = pairGroup === g;
              const isGo = g === "go";
              const isAct = g === "act";
              const isWatch = g === "watch";
              return (
                <button
                  key={g}
                  onClick={() => {
                    setPairGroup(g);
                    const target =
                      g === "go" ? goPairs :
                      g === "act" ? actionablePairs :
                      g === "watch" ? watchlistPairs :
                      PAIR_GROUPS[g] ?? PAIRS;
                    if (target.length > 0 && !target.includes(activePair)) {
                      setActivePair(target[0] as Pair);
                    }
                  }}
                  className={[
                    "px-2.5 py-1 rounded font-mono text-2xs font-medium transition-colors",
                    isActive
                      ? isGo || isAct
                        ? "bg-green-500/20 text-green-400"
                        : isWatch
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-surface-s2 text-text-t1"
                      : isGo && goPairs.length > 0
                      ? "text-green-400/70 hover:text-green-400"
                      : isAct && actionablePairs.length > 0
                      ? "text-green-400/70 hover:text-green-400"
                      : isWatch && watchlistPairs.length > 0
                      ? "text-amber-400/70 hover:text-amber-400"
                      : "text-text-t4 hover:text-text-t2",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Pair grid header — skor sıralaması toggle */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setSortByScore((s) => !s)}
              className={[
                "px-2 py-0.5 rounded font-mono text-2xs border transition-colors",
                sortByScore
                  ? "bg-brand/20 border-brand text-brand"
                  : "border-border text-text-t4 hover:text-text-t2",
              ].join(" ")}
            >
              {sortByScore ? "↓ SKOR" : "SIRALA"}
            </button>
          </div>

          {/* Pair grid — v2: 3 kolon, kapsül slider kartları */}
          <div className="grid grid-cols-3 gap-1">
            {pairGroup === "watch" && watchlistPairs.length === 0 ? (
              <div className="col-span-3 flex flex-col items-center justify-center py-10 gap-1.5">
                <span className="font-mono text-[28px] text-text-t4/30 leading-none">☆</span>
                <p className="font-mono text-[11px] text-text-t3 text-center">Takip listen boş</p>
                <p className="font-mono text-[10px] text-text-t4 text-center px-6">kartlardaki ☆ ile pair ekle</p>
              </div>
            ) : displayPairs.map((p) => {
              const pr = allResults[p];
              const v = pr?.verdict;
              const score = pr?.score;
              const dir = pr?.direction;
              const isActive = activePair === p;


              const goGap = v === "go" && score !== undefined && pr?.effectiveThreshold !== undefined
                ? score - pr.effectiveThreshold
                : -1;
              const goStrength: "strong" | "medium" | "weak" | null =
                goGap >= 15 ? "strong"
                : goGap >= 8  ? "medium"
                : goGap >= 0  ? "weak"
                : null;

              const goRingClass =
                goStrength === "strong" ? "ring-green-400/90"
                : goStrength === "medium" ? "ring-green-400/60"
                : goStrength === "weak"   ? "ring-yellow-400/70"
                : "";
              const goPingClass =
                goStrength === "strong" ? "bg-green-300"
                : goStrength === "medium" ? "bg-green-400"
                : "bg-yellow-400";
              const goBgClass =
                goStrength === "strong" ? "bg-green-500/10"
                : goStrength === "medium" ? "bg-green-500/5"
                : "bg-yellow-500/5";

              const dirArrow = dir === "LONG" ? "▲" : dir === "SHORT" ? "▼" : "";

              const pairChg = allTicks[p]?.chg ?? null;
              const chgColor =
                pairChg === null ? "text-text-t4"
                : pairChg > 0 ? "text-signal-up"
                : pairChg < 0 ? "text-signal-down"
                : "text-text-t4";

              const snaps = (scoreHistory[p] ?? []).filter(
                (s) => typeof s.score === "number" && isFinite(s.score),
              );
              const momentum = pairMomentum[p];
              const showMom = momentum !== undefined && Math.abs(momentum) >= 5;
              const momColor = (momentum ?? 0) > 0 ? "text-green-400" : "text-red-400";

              const isWatched = watchlistPairs.includes(p);

              return (
                <div key={p} className="relative group">
                  {goStrength && !isActive && (
                    <>
                      <div className={`absolute inset-0 rounded-lg ring-1 ${goRingClass} animate-pulse pointer-events-none`} />
                      <span className="absolute top-0.5 left-0.5 flex h-2 w-2 pointer-events-none z-10">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${goPingClass} opacity-60`} />
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${goPingClass}`} />
                      </span>
                    </>
                  )}
                  {p === "BTC" && btcPulseActive && (
                    <span className="absolute inset-0 rounded-lg ring-1 ring-white/25 animate-[ping_600ms_ease-out_1] pointer-events-none z-20" aria-hidden />
                  )}

                  <button
                    onClick={() => setActivePair(p as Pair)}
                    style={v === "go" ? {
                      boxShadow: goStrength === "strong"
                        ? "0 0 12px 2px rgba(74,222,128,0.35)"
                        : "0 0 10px 1px rgba(34,197,94,0.22)",
                      willChange: "box-shadow",
                    } : undefined}
                    className={[
                      "w-full text-left rounded-lg border p-1.5 font-mono transition-colors card-depth",
                      isActive
                        ? `${activeBorderClass(score)} bg-surface-s2 text-text-t1`
                        : goStrength === "strong"
                        ? `border-green-400/50 ${goBgClass} text-text-t3 hover:text-text-t2`
                        : goStrength
                        ? `border-green-500/25 ${goBgClass} text-text-t3 hover:text-text-t2`
                        : v === "wait"
                        ? "border-amber-400/20 bg-bg-card text-text-t3 hover:text-text-t2"
                        : "border-border/30 bg-bg-card text-text-t3 hover:text-text-t2",
                    ].join(" ")}
                  >
                    {/* Satır 1: watchlist chip + pair adı + 24h% rozeti */}
                    <div className="flex items-center justify-between gap-0.5 mb-0.5">
                      <div className="flex items-center gap-0.5 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isWatched) {
                              watchlistToggle(p as Pair);
                              toast(t("watchlist.toast.removed", { pair: p }));
                            } else {
                              watchlistToggle(p as Pair);
                              toast(t("watchlist.toast.added", { pair: p }));
                            }
                          }}
                          className={`shrink-0 px-0.5 py-2 leading-none font-mono text-[9px] transition-colors ${
                            isWatched ? "text-amber-400" : "text-text-t4/50"
                          }`}
                        >
                          {isWatched ? "★" : "☆"}
                        </button>
                        <CoinIcon pair={p as Pair} size={18} />
                        <span className="text-[11px] font-bold text-text-t1 leading-none">{p}</span>
                        {PAIR_CATEGORY[p] && (
                          <span className="text-[7px] font-mono text-sky-400/80 shrink-0 leading-none">
                            {PAIR_CATEGORY[p]}
                          </span>
                        )}
                        {alarmedPairs.has(p) && (
                          <span className="h-1 w-1 rounded-full bg-amber-400 shrink-0" />
                        )}
                      </div>
                      {pairChg !== null && (
                        <span translate="no" className={`text-[8px] tabular-nums px-0.5 py-px rounded-sm bg-surface-s2 leading-tight shrink-0 ${chgColor}`}>
                          {`${pairChg >= 0 ? "+" : ""}${pairChg.toFixed(1)}%`}
                        </span>
                      )}
                    </div>

                    {/* ScoreRingV2 — tüm paritelerde */}
                    <div className="flex justify-center py-0.5">
                      {score !== undefined && pr?.goThreshold !== undefined ? (
                        <ScoreRingV2
                          score={score}
                          goThreshold={pr.goThreshold}
                          snaps={snapScoresByPair[p] ?? []}
                          size={52}
                          id={p}
                        />
                      ) : (
                        <div className="h-[64px] flex items-center justify-center">
                          <span className="text-text-t4 font-mono text-lg">·</span>
                        </div>
                      )}
                      {showMom && (
                        <span className={`text-[8px] leading-none ml-px ${momColor}`}>
                          {(momentum ?? 0) > 0 ? "▲" : "▼"}
                        </span>
                      )}
                      {/* Delta badge — 30dk zaman-penceresi. TEMP DEBUG: veri yoksa "–" (boş bırakma yerine),
                          "veri yok" ile "hiç render edilmedi" ayrımı netleşsin diye — iş bitince eski haline dönecek. */}
                      {(() => {
                        const v = computeScoreVelocity(snaps, DELTA_BADGE_WINDOW_MIN);
                        if (!v || v.actualMin === 0) {
                          return (
                            <span
                              translate="no"
                              className="ml-1 font-mono text-[7px] tabular-nums leading-none opacity-40 text-text-t4"
                            >
                              –
                            </span>
                          );
                        }
                        const sign = v.delta > 0 ? "+" : "";
                        const dc =
                          v.delta > 0 ? "text-green-400"
                          : v.delta < 0 ? "text-red-400"
                          : "text-text-t4";
                        return (
                          <span
                            translate="no"
                            className={`ml-1 font-mono text-[7px] tabular-nums leading-none opacity-70 ${dc}`}
                          >
                            ~{v.actualMin}dk {sign}{Math.round(v.delta)}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Hold/Exit Guide — sadece results[p] + scoreHistory[p]'den türetilir, skor motoruna dokunmaz */}
                    {(() => {
                      const guide = computeHoldExitGuide(pr, snaps);
                      if (!guide) return null;
                      const gc =
                        guide === "max_hold" ? "text-green-400 bg-green-400/10"
                        : guide === "quick_profit" ? "text-amber-400 bg-amber-400/10"
                        : guide === "early_exit_warning" ? "text-red-400 bg-red-400/10"
                        : "text-text-t4 bg-text-t4/10";
                      return (
                        <div className="flex justify-center -mt-0.5 mb-0.5">
                          <span translate="no" className={`text-[8px] font-mono px-1.5 py-0.5 rounded leading-none ${gc}`}>
                            {HOLD_EXIT_LABEL_TEXT[guide]}
                          </span>
                        </div>
                      );
                    })()}

                    {/* WAIT badge */}
                    {v === "wait" && score !== undefined && (
                      <div className="flex justify-center -mt-0.5">
                        <span translate="no" className="text-[8px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          {`Wait ${dirArrow}${score}`}
                        </span>
                      </div>
                    )}

                    {/* MTF mini trend satırı: 1H / 4H / 1D */}
                    {mtfResults[p]?.trends && (
                      <div className="flex justify-center gap-2.5 mt-1 border-t border-border/30 pt-1">
                        {mtfResults[p]!.trends.map((t) => (
                          <span key={t.tf} className="flex flex-col items-center" style={{ gap: "1px" }}>
                            <span className="text-2xs font-mono uppercase tracking-wider text-text-t2/70 leading-none">{t.tf}</span>
                            <span className={`text-[10px] font-mono leading-none ${
                              t.direction === "up"   ? "text-[#22c55e]"
                              : t.direction === "down" ? "text-[#ef4444]/80"
                              : "text-text-t2/50"
                            }`}>
                              {t.direction === "up" ? "▲" : t.direction === "down" ? "▼" : "─"}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Alt: fiyat + market cap */}
                    <div className="flex items-center justify-between mt-1 gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          v === "go"    ? "bg-green-400"
                          : v === "wait"  ? "bg-amber-400"
                          : "bg-red-400/50"
                        }`} />
                        {allTicks[p]?.last !== undefined && (
                          <span translate="no" className="text-[11px] font-semibold tabular-nums text-text-t1 leading-none tracking-tight">
                            {formatTickPrice(allTicks[p]!.last, locale)}
                          </span>
                        )}
                      </div>
                      {marketCap[p] !== undefined && (
                        <span translate="no" className="text-[8px] tabular-nums text-text-t4 leading-none shrink-0">
                          ${fmtCompact(marketCap[p]!)}
                        </span>
                      )}
                    </div>
                  </button>

                  {pairNotes[p as Pair] && (
                    <span className="absolute bottom-2 right-1 h-1 w-1 rounded-full bg-blue-400/80 pointer-events-none" />
                  )}
                </div>
              );
            })}


          </div>
          </div>{/* end pair grid wrapper */}
        </div>

        {/* RIGHT MAIN — active pair details */}
        <div className="flex flex-col gap-3 lg:flex-1 lg:min-w-0 order-1 lg:order-2">
          {!result && (
            <div className="bg-surface-s1 rounded-lg p-6 text-center font-mono text-sm text-text-t3">
              {computing ? t("karar.computing") : t("karar.waitingData")}
            </div>
          )}

          {result && (
            <>
              {/* ── Premium hero card ── */}
              <div
                className="rounded-xl flex flex-col gap-2 sm:gap-3 px-4 py-2 sm:py-4"
                style={{
                  border: "1px solid transparent",
                  background: "linear-gradient(rgb(var(--bg-card)), rgb(var(--bg-card))) padding-box, linear-gradient(135deg, rgba(184, 140, 60, 0.38) 0%, rgba(90, 70, 25, 0.08) 50%, rgba(184, 140, 60, 0.38) 100%) border-box",
                  boxShadow: "inset 0 1px 0 rgba(200, 165, 70, 0.09), inset 0 0 28px rgba(0, 0, 0, 0.18), 0 4px 24px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(184, 140, 60, 0.10)",
                }}
              >

              {/* QUANTIX OS header band */}
              <div className="-mt-2 sm:-mt-4 -mx-4 mb-1 px-4 py-0.5 sm:py-1.5 rounded-t-[10px] flex items-center gap-2 select-none panel-header-band">
                <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-text-t4">
                  QUANTIX OS
                </span>
                {isStale && result && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400/50 animate-pulse shrink-0"
                    title="Veriler güncelleniyor…"
                  />
                )}
                {staleFailed && result && (
                  <span className="inline-flex items-center gap-1 font-mono text-[8px] text-red-400/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                    bayat veri
                  </span>
                )}
                <span className="ml-auto font-mono text-[8px] text-text-t4/45 tracking-wider tabular-nums">
                  {activePair}
                </span>
              </div>

              {/* 2-col from md (768px): left = info/badges, right = score gauge */}
              <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-start md:gap-4">

                {/* Left sub-col: price header + position strip + verdict + protection badges */}
                <div className="flex flex-col gap-2 sm:gap-3 md:flex-1 md:min-w-0">

                  {/* Price header */}
                  <PairPriceHeader
                    pair={activePair}
                    price={livePrice}
                    chg={allTicks[activePair]?.chg ?? null}
                  />

                  {/* Active position strip — shown when this pair has an open position */}
                  {activePosition && (
                    <Link
                      href="/portfolyo"
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-s1 px-3 py-2 font-mono text-2xs hover:bg-surface-s2 transition-colors"
                    >
                      <span className={`font-bold shrink-0 ${activePosition.direction === "LONG" ? "text-green-400" : "text-red-400"}`}>
                        {activePosition.direction === "LONG" ? "▲ LONG" : "▼ SHORT"}
                      </span>
                      <span className="text-text-t3 shrink-0">
                        @{fmtPx(activePosition.entryPx)}
                      </span>
                      <span translate="no" className={`font-semibold tabular-nums shrink-0 ${activePosition.upl >= 0 ? "text-signal-green" : "text-signal-red"}`}>
                        {`${activePosition.upl >= 0 ? "+" : ""}${activePosition.upl.toFixed(0)}$`}
                      </span>
                      {activeTrade && (
                        <span className="text-text-t4 shrink-0">{holdingStr(activeTrade.openedAt)}</span>
                      )}
                      <span className="text-text-t4 ml-auto shrink-0">→</span>
                    </Link>
                  )}

                  {/* HERO: Verdict + Direction + Regime — inset metallic panel */}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 panel-inset-strong">
                    <VerdictBadge
                      verdict={result.verdict}
                      signalType={result.pullbackActive ? "pullback" : "classic"}
                    />
                    <DirectionBadge
                      direction={result.direction}
                      confidence={result.dirConfidence}
                    />
                    <RegimeBadge pair={activePair} baseThreshold={result.effectiveThreshold} />
                  </div>

                  {/* Protection badges — inset info panel */}
                  <div className="flex flex-wrap gap-1.5 rounded-lg px-3 py-2 panel-inset">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-brand/25 bg-brand/8 font-mono text-[9px] text-brand/70 tracking-wide select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand/60 shrink-0" />
                      {result.pullbackActive ? t("karar.profilePullback") : t("karar.profileTrend")}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-500/25 bg-emerald-500/8 font-mono text-[9px] text-emerald-400/70 tracking-wide select-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                      {t("karar.signalBarClose")}
                    </span>
                  </div>

                </div>

                {/* Right sub-col: kadran (sol) + SM/FLOW/VOL DELTA (sağ) */}
                <div className="flex gap-2 items-start md:w-52 md:shrink-0">

                  {/* Gauge */}
                  <div className="w-[140px] shrink-0 md:flex-1 md:min-w-0">
                    <ScoreGauge
                      score={result.score}
                      threshold={result.effectiveThreshold}
                      goThreshold={result.goThreshold}
                    />
                  </div>

                  {/* SM + FLOW badge + VOL DELTA + GO/F&G — kadranın sağında dikey sıra */}
                  <div className="grid grid-cols-2 gap-1 flex-1 md:flex md:flex-col md:gap-1.5 md:w-[82px] md:shrink-0">

                    {/* Smart Money */}
                    {flowResult && (
                      <div className="rounded-lg px-2 py-1.5 panel-inset">
                        <div className="text-[8px] font-mono text-text-t4 tracking-widest uppercase mb-0.5 leading-none">Smart $</div>
                        {flowResult.flowVerdict.vpin?.ready ? (
                          <>
                            <div className={`text-[11px] font-mono font-bold leading-tight ${
                              flowResult.flowVerdict.vpin.toxicity === "toxic" || flowResult.flowVerdict.vpin.toxicity === "extreme"
                                ? "text-signal-down"
                                : flowResult.flowVerdict.vpin.toxicity === "normal"
                                ? "text-signal-up"
                                : "text-warning"
                            }`}>{flowResult.flowVerdict.vpin.toxicity.toUpperCase()}</div>
                            <div className="text-[8px] font-mono text-text-t4 tabular-nums leading-none mt-0.5">
                              VPIN {flowResult.flowVerdict.vpin.vpin.toFixed(2)}
                            </div>
                          </>
                        ) : flowResult.flowVerdict.vpin !== null ? (
                          <div className="text-[8px] font-mono text-text-t4 leading-tight">
                            {flowResult.flowVerdict.vpin.bucketCount}/10
                            <span className="opacity-60"> buf</span>
                          </div>
                        ) : (
                          <div className="text-[8px] font-mono text-text-t4">—</div>
                        )}
                      </div>
                    )}

                    {/* FLOW badge */}
                    {flowResult && (
                      <div
                        className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 ${
                          flowResult.vetoed || flowResult.totalAdjustment < -5
                            ? "border-red-500/30 bg-red-500/5"
                            : flowResult.totalAdjustment > 5
                            ? "border-green-500/30 bg-green-500/5"
                            : "border-border bg-surface-s1"
                        } ${flowPulseClass}`}
                        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 5px rgba(0,0,0,0.40)" }}
                      >
                        <span className="text-[8px] font-mono text-text-t4 tracking-widest uppercase leading-none">FLOW</span>
                        <span className={`text-sm font-mono font-bold tabular-nums leading-tight ${
                          flowResult.vetoed || flowResult.totalAdjustment < 0
                            ? "text-signal-down"
                            : flowResult.totalAdjustment > 0
                            ? "text-signal-up"
                            : "text-text-t3"
                        }`}>
                          {flowResult.totalAdjustment > 0 ? `+${flowResult.totalAdjustment}` : `${flowResult.totalAdjustment}`}
                        </span>
                        <span className="text-[8px] font-mono text-text-t4 tabular-nums leading-none">×{flowResult.confidenceMultiplier.toFixed(2)}</span>
                      </div>
                    )}

                    {/* VOL DELTA */}
                    {flowResult && (
                      <div className="rounded-lg px-2 py-1.5 panel-inset">
                        <div className="text-[8px] font-mono text-text-t4 tracking-widest uppercase mb-0.5 leading-none">Vol Δ 5m</div>
                        <div className={`text-[11px] font-mono font-bold tabular-nums leading-tight ${
                          flowResult.flowVerdict.cvd.w5m.direction === "bullish" ? "text-signal-up"
                            : flowResult.flowVerdict.cvd.w5m.direction === "bearish" ? "text-signal-down"
                            : "text-text-t3"
                        }`}>{formatCvd(flowResult.flowVerdict.cvd.w5m.cvdUsd)}</div>
                        <div className="text-[8px] font-mono text-text-t4 uppercase leading-none mt-0.5">{flowResult.flowVerdict.cvd.w5m.direction}</div>
                      </div>
                    )}

                    {/* GO / F&G — koşulsuz, flowResult'a bağlı değil */}
                    <div className="rounded-lg px-2 py-1.5 panel-inset">
                      <div className="text-[8px] font-mono text-text-t4 tracking-widest uppercase mb-0.5 leading-none">GO</div>
                      <div
                        className={`text-[14px] font-mono font-bold tabular-nums leading-tight ${goPairs.length > 0 ? "text-green-400" : "text-text-t4"}`}
                        style={goPairs.length > 0 ? { textShadow: "0 0 10px rgba(74,222,128,0.45)" } : undefined}
                      >
                        {goPairs.length}
                        <span className="text-[8px] font-mono text-text-t4 font-normal tabular-nums">/{PAIRS.length}</span>
                      </div>
                      {fgValue !== null ? (
                        <div className="text-[8px] font-mono text-text-t4 tabular-nums leading-none mt-0.5">
                          {"F&G"}{" "}
                          <span className={`font-semibold ${
                            fgValue >= 75 ? "text-red-400"
                            : fgValue >= 55 ? "text-amber-400"
                            : fgValue >= 45 ? "text-text-t2"
                            : fgValue >= 25 ? "text-blue-400"
                            : "text-blue-500"
                          }`}>{fgValue}</span>
                        </div>
                      ) : allTicks["BTC"]?.last !== undefined ? (
                        <div className="text-[8px] font-mono text-text-t4 tabular-nums leading-none mt-0.5">
                          {"BTC"}{" "}
                          <span translate="no" className="font-semibold text-text-t2">
                            {formatTickPrice(allTicks["BTC"]!.last, locale)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[8px] font-mono text-text-t4 leading-none mt-0.5">—</div>
                      )}
                    </div>

                  </div>

                </div>

              </div>

              {/* AI Market Note — metallic inset panel */}
              <div className="flex items-start gap-2 rounded-lg px-3 py-2 panel-ai-note">
                <span className="shrink-0 font-mono text-[8px] tracking-widest text-brand/60 border border-brand/25 rounded px-1 py-0.5 leading-none mt-0.5 select-none">{t("karar.aiBadge")}</span>
                <p className="font-mono text-[11px] text-text-t1 leading-relaxed">{aiMarketNote(result, t)}</p>
              </div>

              </div>{/* end premium hero card */}

              {/* Flow drilldown */}
              <FlowAlignmentRow flow={flowResult} />

              {/* OI Divergence — gözlem göstergesi, skor motoruna bağlı değil */}
              {oiVelocityForPair && (
                <div className="flex items-center justify-between bg-surface-s2 rounded-md px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          oiDivergence === "confirm" ? "#22c55e"
                          : oiDivergence === "diverge" ? "#ef4444"
                          : "#6b7280",
                      }}
                    />
                    <span className="text-text-t4 text-[10px] font-mono tracking-widest uppercase">OI DIV</span>
                    <span className="text-text-t4 text-[10px] font-mono opacity-60">
                      {oiVelocityForPair.regime.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${
                    oiDivergence === "confirm" ? "text-signal-up"
                    : oiDivergence === "diverge" ? "text-signal-down"
                    : "text-text-t4"
                  }`}>
                    {oiDivergence === "confirm" ? "✓ ONAY"
                    : oiDivergence === "diverge" ? "⚠ DIVERJANS"
                    : "○ NÖTR"}
                  </span>
                </div>
              )}

              {/* 4 analysis accordions + Detaylar */}
              <div className="flex flex-col gap-2">

                {/* TREND */}
                <AccordionSection
                  title="TREND"
                  badge={`${result.sub.trend}/25`}
                  dotColor={result.sub.trend >= 17 ? "#22c55e" : result.sub.trend >= 10 ? "#f59e0b" : "#ef4444"}
                  open={showTrend}
                  onToggle={() => setShowTrend((v) => !v)}
                >
                  <div className="rounded-lg px-3 py-2 space-y-2 panel-inset">
                    <div className="flex items-center justify-between text-2xs font-mono">
                      <span className="text-text-t4 uppercase tracking-widest">Skor</span>
                      <span className="font-bold tabular-nums text-text-t1">{result.sub.trend} / 25</span>
                    </div>
                    {result.reasons.trend && (
                      <p className="text-2xs font-mono text-text-t3 leading-relaxed">{result.reasons.trend}</p>
                    )}
                    <div className="border-t border-border/40 pt-2 space-y-1.5">
                      <EmaAlignRow label="4H" close={candles4h.at(-1)?.close ?? null} ema200={ema200_4h} />
                      <EmaAlignRow label="1H" close={candles1h.at(-1)?.close ?? null} ema200={ema200_1h} />
                      <EmaAlignRow label="15M" close={candles15m.at(-1)?.close ?? null} ema200={ema200_15m} />
                    </div>
                  </div>
                  <ScoreHistoryChart snapshots={Array.isArray(scoreHistory[activePair]) ? scoreHistory[activePair] : []} t={t} />
                </AccordionSection>

                {/* HACİM */}
                <AccordionSection
                  title={t("karar.volumeSection")}
                  badge={`vol ${result.sub.vol}/8 · bb ${result.sub.bb}/8 · vwap ${result.sub.vwap}/10`}
                  dotColor={(result.sub.vol + result.sub.bb + result.sub.vwap) >= 17 ? "#22c55e" : (result.sub.vol + result.sub.bb + result.sub.vwap) >= 10 ? "#f59e0b" : "#ef4444"}
                  open={showHacim}
                  onToggle={() => setShowHacim((v) => !v)}
                >
                  <div className="rounded-lg px-3 py-2 space-y-2 panel-inset">
                    <SubScoreRow label="Vol" value={result.sub.vol} max={8} reason={result.reasons.vol} />
                    <SubScoreRow label="BB" value={result.sub.bb} max={8} reason={result.reasons.bb} />
                    <SubScoreRow label="VWAP" value={result.sub.vwap} max={10} reason={result.reasons.vwap} />
                  </div>
                </AccordionSection>

                {/* ADX & RSI */}
                <AccordionSection
                  title="ADX & RSI"
                  badge={`adx ${result.sub.adx}/12 · rsi ${result.sub.rsi}/12`}
                  dotColor={(result.sub.adx + result.sub.rsi) >= 16 ? "#22c55e" : (result.sub.adx + result.sub.rsi) >= 10 ? "#f59e0b" : "#ef4444"}
                  open={showMomentum}
                  onToggle={() => setShowMomentum((v) => !v)}
                >
                  <div className="rounded-lg px-3 py-2 space-y-2 panel-inset">
                    <SubScoreRow
                      label="ADX"
                      value={result.sub.adx}
                      max={12}
                      reason={result.reasons.adx}
                      rawValue={adxValue !== null ? adxValue.toFixed(1) : undefined}
                    />
                    <SubScoreRow
                      label="RSI"
                      value={result.sub.rsi}
                      max={12}
                      reason={result.reasons.rsi}
                      rawValue={rsiValue !== null ? rsiValue.toFixed(1) : undefined}
                    />
                  </div>
                </AccordionSection>

                {/* DIVERGENCE */}
                <AccordionSection
                  title="DIVERGENCE"
                  badge={
                    flowResult?.flowVerdict.divergence.confluence
                      ? `⚠ ${flowResult.flowVerdict.divergence.confluenceType.replace(/_/g, " ").toUpperCase()}`
                      : "—"
                  }
                  dotColor={flowResult == null ? "#6b7280" : flowResult.flowVerdict.divergence.confluence ? "#f59e0b" : "#22c55e"}
                  open={showDivergence}
                  onToggle={() => setShowDivergence((v) => !v)}
                >
                  {flowResult ? (
                    <DivergencePanel div={flowResult.flowVerdict.divergence} />
                  ) : (
                    <div className="text-2xs font-mono text-text-t4 px-3 py-2">—</div>
                  )}
                </AccordionSection>

                {/* Detaylar */}
                <AccordionSection
                  title={showDetails ? t("karar.hideDetails") : t("karar.showDetails")}
                  open={showDetails}
                  onToggle={() => setShowDetails((v) => !v)}
                >
                  <div className="flex flex-col gap-3">
                    {/* Alarm + Candle patterns */}
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-[180px]">
                        <QuickAlarm
                          pair={activePair}
                          livePrice={livePrice}
                          direction={result.direction}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <CandlePatternBadge pair={activePair} />
                      </div>
                    </div>

                    {/* Historical edge + Live edge */}
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <HistoricalEdge pair={activePair} />
                      <LiveEdgeBadge pair={activePair} />
                    </div>

                    {/* Score breakdown + Blocks + Reasons */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ScoreBreakdown sub={result.sub} reasons={result.reasons} />
                      <div className="flex flex-col gap-3">
                        <BlocksList
                          hardBlocks={result.blocks}
                          softBlocks={result.softBlocks}
                        />
                        <ReasonsList reasons={result.reasons} />
                      </div>
                    </div>

                    {sizerResult && result.direction !== "NEUTRAL" && (
                      <CorrelationWarning pair={activePair} direction={result.direction} />
                    )}

                    {/* Per-pair trade performance */}
                    <PairTradeStats pair={activePair} />

                    {/* Per-pair GO signal history */}
                    <PairSignalHistory pair={activePair} />

                    {/* Pair note + Backtest quick link */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xs text-text-t4 tracking-wider uppercase shrink-0">
                          Not
                        </span>
                        <Link
                          href={`/backtest?pair=${activePair}`}
                          className="ml-auto font-mono text-2xs text-text-t4 hover:text-brand transition-colors border border-border/40 rounded px-2 py-0.5 shrink-0"
                        >
                          → Backtest
                        </Link>
                      </div>
                      <textarea
                        value={pairNotes[activePair] ?? ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            setPairNote(activePair, e.target.value);
                          } else {
                            clearPairNote(activePair);
                          }
                        }}
                        placeholder={t("karar.notesPlaceholder")}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-surface-s1 px-3 py-2 font-mono text-2xs text-text-t2 placeholder:text-text-t4 resize-none focus:outline-none focus:border-brand/50 transition-colors"
                      />
                    </div>
                  </div>
                </AccordionSection>
              </div>

              {sizerResult && (
                <PositionSizer
                  result={sizerResult}
                  onTrade={() => {
                    setExecError(null);
                    setShowConfirm(true);
                  }}
                />
              )}

              {execError && (
                <div className="bg-soft-red text-signal-red rounded-lg p-3 font-mono text-xs">
                  {execError}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showConfirm && sizerResult && (
        <TradeConfirmModal
          result={sizerResult}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
        />
      )}

      {isExecuting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-card rounded-lg p-6 font-mono text-sm text-text-t1">
            {t("karar.sendingOrder")}
          </div>
        </div>
      )}

      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

function aiMarketNote(
  result: {
    score: number;
    verdict: string;
    direction: string;
    effectiveThreshold: number;
    pullbackActive: boolean;
    sub: { trend: number; adx: number; rsi: number; vol: number; bb: number; vwap: number };
  },
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const { score, direction, effectiveThreshold, pullbackActive, sub } = result;
  const dir = direction === "LONG" ? "LONG" : direction === "SHORT" ? "SHORT" : "FLAT";
  const trendStr = sub.trend >= 17 ? t("karar.trendStrong") : sub.trend >= 10 ? t("karar.trendMedium") : t("karar.trendWeak");
  const volTotal = sub.vol + sub.bb + sub.vwap;
  const volStr = volTotal >= 17 ? t("karar.volumeSupported") : volTotal >= 10 ? t("karar.volumePartial") : t("karar.volumeInsufficient");
  const modeStr = pullbackActive ? t("karar.pullbackMode") : "";
  const gap = effectiveThreshold - score;
  const postureStr = score >= effectiveThreshold
    ? t("karar.thresholdCrossed", { score, threshold: effectiveThreshold })
    : gap <= 8
    ? t("karar.thresholdGap", { gap, score, threshold: effectiveThreshold })
    : t("karar.thresholdBelow", { score, threshold: effectiveThreshold });
  return `${dir} · ${trendStr} · ${volStr}${modeStr} · ${postureStr}.`;
}

function AccordionSection({
  title,
  badge,
  dotColor,
  open,
  onToggle,
  children,
}: React.PropsWithChildren<{
  title: string;
  badge?: string;
  dotColor?: string;
  open: boolean;
  onToggle: () => void;
}>) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono text-2xs text-text-t3 hover:text-text-t2 transition-colors"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.24) 100%)",
          border: "1px solid rgba(184,140,60,0.14)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 4px rgba(0,0,0,0.28)",
        }}
      >
        {dotColor && (
          <span
            className="shrink-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span className="flex-1 tracking-widest uppercase text-left">{title}</span>
        {badge && <span className="text-text-t4 tabular-nums shrink-0 pl-2.5 border-l border-border/50">{badge}</span>}
        <span className="shrink-0 text-text-t4">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="flex flex-col gap-2 mt-2">{children}</div>}
    </div>
  );
}

function SubScoreRow({
  label,
  value,
  max,
  reason,
  rawValue,
}: {
  label: string;
  value: number;
  max: number;
  reason?: string;
  rawValue?: string;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const barColor =
    value >= max * 0.7 ? "bg-signal-up" : value >= max * 0.35 ? "bg-warning" : "bg-signal-down/60";
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-2xs font-mono">
        <span className="text-text-t4 uppercase tracking-wide">{label}</span>
        <span className="flex items-center gap-2">
          {rawValue !== undefined && (
            <span className="text-text-t3 tabular-nums">{rawValue}</span>
          )}
          <span className="text-text-t1 font-bold tabular-nums">{value}/{max}</span>
        </span>
      </div>
      <div className="w-full h-1 bg-surface-s3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      {reason && <p className="text-[10px] font-mono text-text-t4 leading-relaxed">{reason}</p>}
    </div>
  );
}

function EmaAlignRow({
  label,
  close,
  ema200,
}: {
  label: string;
  close: number | null;
  ema200: number | null;
}) {
  const t = useT();
  const status =
    ema200 === null || close === null ? "nodata" : close > ema200 ? "above" : "below";
  const statusText =
    status === "above" ? `${t("karar.emaAbove")} ▲` : status === "below" ? `${t("karar.emaBelow")} ▼` : t("karar.emaNoData");
  const statusColor =
    status === "above" ? "text-signal-up" : status === "below" ? "text-signal-down" : "text-text-t4";
  return (
    <div className="flex items-center justify-between text-2xs font-mono">
      <span className="text-text-t4 uppercase tracking-wide">{label} EMA200</span>
      <span className={`${statusColor} font-medium`}>{statusText}</span>
    </div>
  );
}

function DivergencePanel({
  div,
}: {
  div: import("@/lib/orderflow/divergence").MultiFrameDivergence;
}) {
  const formatDiv = (type: string) => {
    if (type === "bullish_divergence") return "↑ Bullish";
    if (type === "bearish_divergence") return "↓ Bearish";
    return "—";
  };
  const toneColor = (type: string) =>
    type === "bullish_divergence"
      ? "text-signal-up"
      : type === "bearish_divergence"
      ? "text-signal-down"
      : "text-text-t3";
  return (
    <div className="bg-surface-s1 rounded-lg border border-border px-3 py-2 space-y-2">
      <div className="flex items-center justify-between text-2xs font-mono">
        <span className="text-text-t4 uppercase tracking-wide">5M</span>
        <span className={toneColor(div.d5m.type)}>{formatDiv(div.d5m.type)}</span>
      </div>
      {(div.d5m.type === "bullish_divergence" || div.d5m.type === "bearish_divergence") && (
        <p className="text-[10px] font-mono text-text-t4 leading-relaxed">{div.d5m.humanReason}</p>
      )}
      <div className="flex items-center justify-between text-2xs font-mono border-t border-border/40 pt-2">
        <span className="text-text-t4 uppercase tracking-wide">15M</span>
        <span className={toneColor(div.d15m.type)}>{formatDiv(div.d15m.type)}</span>
      </div>
      {(div.d15m.type === "bullish_divergence" || div.d15m.type === "bearish_divergence") && (
        <p className="text-[10px] font-mono text-text-t4 leading-relaxed">{div.d15m.humanReason}</p>
      )}
      {div.confluence && (
        <div className="border-t border-border/40 pt-2">
          <span className={`text-2xs font-mono font-bold ${toneColor(div.confluenceType)}`}>
            ⚠ CONFLUENCE: {div.confluenceType.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

function ScoreHistoryChart({
  snapshots,
  t,
}: {
  snapshots: import("@/lib/store/scoreHistoryStore").ScoreSnapshot[];
  t: (key: string) => string;
}) {
  const pts = snapshots.slice(-40);
  if (pts.length < 2) return null;

  const W = 320;
  const H = 36;
  const PAD = 2;
  const n = pts.length;
  const xStep = (W - PAD * 2) / (n - 1);

  function xOf(i: number) { return PAD + i * xStep; }
  function yOf(s: number) { return PAD + ((100 - s) / 100) * (H - PAD * 2); }

  const segments: { d: string; color: string }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const color = p.verdict === "go" ? "#22c55e" : p.verdict === "wait" ? "#f59e0b" : "#ef4444";
    segments.push({
      d: `M${xOf(i - 1).toFixed(1)},${yOf(pts[i-1].score).toFixed(1)}L${xOf(i).toFixed(1)},${yOf(p.score).toFixed(1)}`,
      color,
    });
  }

  const yGo = yOf(90);
  const latest = pts[pts.length - 1];

  return (
    <div className="border-border bg-bg-card rounded-lg border px-3 pt-2 pb-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">{t("karar.scoreTrend")}</span>
        <span translate="no" className="text-text-t4 font-mono text-2xs">{`${pts.length} ${t("karar.snapshots")}`}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <line x1={PAD} y1={yGo} x2={W - PAD} y2={yGo}
          stroke="#22c55e" strokeWidth="0.5" strokeDasharray="3,3" strokeOpacity="0.35" />
        {segments.map((seg, i) => (
          <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth="1.5" strokeOpacity="0.8" />
        ))}
        <circle
          cx={xOf(n - 1)}
          cy={yOf(latest.score)}
          r="2.5"
          fill={latest.verdict === "go" ? "#22c55e" : latest.verdict === "wait" ? "#f59e0b" : "#ef4444"}
        />
      </svg>
      <div className="flex justify-between mt-0.5">
        <span translate="no" className="text-text-t4 font-mono text-2xs">{pts[0].ts ? new Date(pts[0].ts).toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"}) : ""}</span>
        <span translate="no" className="text-text-t4 font-mono text-2xs">{latest.ts ? new Date(latest.ts).toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"}) : ""}</span>
      </div>
    </div>
  );
}

function fmtPrice(price: number): string {
  if (price >= 10_000) return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 100)    return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)      return "$" + price.toFixed(4);
  if (price >= 0.001)  return "$" + price.toFixed(5);
  return "$" + price.toPrecision(4);
}

function holdingStr(openedAt: number): string {
  const m = Math.floor((Date.now() - openedAt) / 60_000);
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}sa` : `${Math.floor(h / 24)}g`;
}

function fmtPx(px: number): string {
  if (px >= 1000) return px.toFixed(1);
  if (px >= 100) return px.toFixed(2);
  if (px >= 1) return px.toFixed(3);
  if (px >= 0.001) return px.toFixed(5);
  return px.toPrecision(4);
}

function PairPriceHeader({
  pair,
  price,
  chg,
}: {
  pair: import("@/lib/constants/pairs").Pair;
  price: number | null;
  chg: number | null;
}) {
  const chgColor =
    chg === null ? "text-text-t3"
    : chg > 0 ? "text-signal-up"
    : chg < 0 ? "text-signal-down"
    : "text-text-t3";

  return (
    <div className="flex items-center justify-between bg-surface-s1 rounded-lg px-3 py-2 sm:py-2.5">
      <span className="font-mono text-base font-bold text-text-t1 tracking-wide">{pair}</span>
      <div className="flex items-center gap-3">
        {price !== null && (
          <span translate="no" className="font-mono text-xl font-bold text-text-t1 tabular-nums tracking-tight">
            {fmtPrice(price)}
          </span>
        )}
        {chg !== null && (
          <span translate="no" className={`font-mono text-sm font-semibold tabular-nums ${chgColor}`}>
            {`${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`}
          </span>
        )}
      </div>
    </div>
  );
}

function scoreAge(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}
