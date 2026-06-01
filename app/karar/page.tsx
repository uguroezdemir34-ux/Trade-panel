"use client";

import { useState, useMemo, useEffect } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMacroStore } from "@/lib/store/macroStore";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useWatchlistStore } from "@/lib/store/watchlistStore";

const PAIR_GROUPS: Record<string, readonly Pair[]> = {
  all:    PAIRS,
  majors: ["BTC", "ETH", "BNB", "XRP", "SOL"],
  alts:   ["ADA", "AVAX", "DOT", "LINK", "POL", "NEAR", "FET", "SUI"],
  meme:   ["DOGE", "SHIB"],
};
type PairGroup = "all" | "majors" | "alts" | "meme" | "go" | "watch";
import { VerdictBadge } from "@/components/karar/VerdictBadge";
import { ScoreBar } from "@/components/karar/ScoreBar";
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
import { toIndicatorCandle } from "@/lib/okx/candles";
import { findSwingLevels } from "@/lib/sr/swing";
import { orchestrate } from "@/lib/orchestrator/router";
import { getOkxAdapter } from "@/lib/exchange/okx-adapter";
import { createChannel } from "@/lib/notify/registry";
import { getGlobalDedupeStore } from "@/lib/orchestrator/dedupe";
import type { PositionSizerResult } from "@/lib/sizer/types";
import { useFlowIntelligence } from "@/lib/hooks/useFlowIntelligence";
import { getBucketStats } from "@/lib/bucket/stats";
import { useScoreHistoryStore } from "@/lib/store/scoreHistoryStore";
import { ScoreSparkline } from "@/components/karar/ScoreSparkline";
import { ScoreLeaderboard } from "@/components/karar/ScoreLeaderboard";
import { QuickAlarm } from "@/components/karar/QuickAlarm";
import { StreakBanner } from "@/components/karar/StreakBanner";
import { LiveEdgeBadge } from "@/components/karar/LiveEdgeBadge";
import { GoSignalLog } from "@/components/karar/GoSignalLog";
import { HistoricalEdge } from "@/components/karar/HistoricalEdge";
import { FundingBadge } from "@/components/karar/FundingBadge";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";

export default function KararPage() {
  const [activePair, setActivePair] = useState<Pair>("BTC");
  const [pairGroup, setPairGroup] = useState<PairGroup>("all");
  const watchlistPairs = useWatchlistStore((s) => s.pairs);
  const watchlistToggle = useWatchlistStore((s) => s.toggle);
  const watchlistLoad = useWatchlistStore((s) => s.load);

  useEffect(() => { watchlistLoad(); }, [watchlistLoad]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  const result = useScoreStore((s) => s.results[activePair]);
  const allResults = useScoreStore((s) => s.results);
  const computedAt = useScoreStore((s) => s.computedAt);
  const computing = useScoreStore((s) => s.computing);
  const scoreHistory = useScoreHistoryStore((s) => s.history);
  const candles1hRaw = useCandleStore((s) => s.candles[`${activePair}_1h`]);
  const candles4hRaw = useCandleStore((s) => s.candles[`${activePair}_4h`]);
  const candles1h = candles1hRaw ?? EMPTY_CANDLES;
  const candles4h = candles4hRaw ?? EMPTY_CANDLES;
  const livePrice = useMarketStore((s) => s.prices[activePair]?.last ?? null);
  const balanceTotal = useAccountStore((s) => s.balanceTotal);
  const balanceFree = useAccountStore((s) => s.balanceFree);
  const drawdownProtocol = useAccountStore((s) => s.drawdownProtocol);
  const maxTradesPerDay = useSettingsStore((s) => s.maxTradesPerDay);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const forwardTestMode = useSettingsStore((s) => s.forwardTestMode);
  const btcCooldownUntil = useRiskStore((s) => s.btcCooldownUntil);
  const btcSelfCooldownUntil = useRiskStore((s) => s.btcSelfCooldownUntil);
  const logEvent = useRiskStore((s) => s.logEvent);
  const trades = useTradesStore((s) => s.trades);
  const openPending = useTradesStore((s) => s.openPending);
  const funding = useMacroStore((s) => s.funding);
  const fgValue = useMacroStore((s) => s.fgValue);

  // Keyboard shortcuts: 1-9 → select pair by index, G → next GO pair
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
      const digit = parseInt(e.key);
      if (!isNaN(digit) && digit >= 1 && digit <= 9) {
        const target = PAIRS[digit - 1];
        if (target) setActivePair(target);
        return;
      }
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

  // GO sinyali olan pariteler (tümü için özet)
  const goPairs = useMemo(
    () => PAIRS.filter((p) => allResults[p]?.verdict === "go"),
    [allResults],
  );

  // Aktif alarmı olan pariteler
  const alarms = usePriceAlarmStore((s) => s.alarms);
  const alarmedPairs = useMemo(
    () => new Set(alarms.filter((a) => a.status === "active").map((a) => a.pair)),
    [alarms],
  );

  // Filtreli parite listesi
  const displayPairs = useMemo<readonly Pair[]>(() => {
    if (pairGroup === "go") return goPairs.length > 0 ? goPairs : PAIRS;
    if (pairGroup === "watch") return watchlistPairs.length > 0 ? watchlistPairs : PAIRS;
    return PAIR_GROUPS[pairGroup] ?? PAIRS;
  }, [pairGroup, goPairs, watchlistPairs]);

  // Skor momentumu — son 4 snapshot'taki net skor değişimi
  const pairMomentum = useMemo<Partial<Record<Pair, number>>>(() => {
    const out: Partial<Record<Pair, number>> = {};
    for (const p of PAIRS) {
      const snaps = scoreHistory[p];
      if (!snaps || snaps.length < 4) continue;
      const recent = snaps.slice(-4);
      out[p] = recent[recent.length - 1].score - recent[0].score;
    }
    return out;
  }, [scoreHistory]);

  // En son hesaplanan skor zamanı
  const latestScoreTime = useMemo(() => {
    const times = Object.values(computedAt).filter((v): v is number => v !== undefined);
    return times.length > 0 ? Math.max(...times) : null;
  }, [computedAt]);

  // Bucket istatistikleri — geçmiş trade'lerden score bazlı performans
  const bucketStats = useMemo(() => {
    if (!result) return null;
    const closedTrades = trades
      .filter((t) => t.status === "closed" && t.exit != null && t.pair === activePair)
      .map((t) => ({ score: t.entryContext.score, pnlUsd: t.exit!.pnlUsd }));
    return getBucketStats(result.score, closedTrades);
  }, [result, trades, activePair]);

  // Signal direction for flow intelligence (uppercase: "LONG" | "SHORT")
  const signalDir: "LONG" | "SHORT" =
    result?.direction === "SHORT" ? "SHORT" : "LONG";

  const flowResult = useFlowIntelligence(activePair, signalDir);

  const atrValue = useMemo(() => {
    if (candles1h.length < 15) return null;
    return atr(candles1h.map(toIndicatorCandle), { period: 14 });
  }, [candles1h]);

  // ADX ham değeri — TP modunu belirlemek için (weak/healthy/strong)
  const adxValue = useMemo(() => {
    if (candles1h.length < 29) return null;
    return adx(candles1h.map(toIndicatorCandle), 14)?.adx ?? null;
  }, [candles1h]);

  // Swing seviyeleri — yapısal stop için
  // 4h öncelikli (daha anlamlı yapı), 1h fallback
  const swingLevels = useMemo(() => {
    const sw4h =
      candles4h.length >= 10
        ? findSwingLevels(candles4h.map(toIndicatorCandle), 20, 2)
        : { swingLow: null, swingHigh: null };
    const sw1h =
      candles1h.length >= 10
        ? findSwingLevels(candles1h.map(toIndicatorCandle), 30, 2)
        : { swingLow: null, swingHigh: null };
    // 4h varsa kullan, yoksa 1h'a düş
    return {
      swingLow: sw4h.swingLow ?? sw1h.swingLow,
      swingHigh: sw4h.swingHigh ?? sw1h.swingHigh,
    };
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

  async function handleConfirm() {
    if (!sizerResult || !result || !livePrice) return;
    if (result.direction !== "LONG" && result.direction !== "SHORT") return;

    setIsExecuting(true);
    setExecError(null);

    const today = new Date();
    const todayTrades = trades.filter((t) => {
      const d = new Date(t.openedAt);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });

    const fundingResult = funding[activePair] ?? null;

    // ── Forward Test Mode: bypass exchange, record paper trade directly ──
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

    try {
      const output = await orchestrate(
        {
          signal: result,
          pair: activePair,
          livePrice,
          qty: sizerResult.qty,
          stopPrice: sizerResult.stop.stopPrice,
          takeProfitPrice: sizerResult.tp.tp1Price,
          leverage: sizerResult.leverage,
          marginMode: "cross",
          source: "manual",
          accountState: {
            drawdownProtocol,
            btcCooldownUntil,
            btcSelfCooldownUntil,
            todayTradeCount: todayTrades.length,
            maxTradesPerDay,
          },
        },
        {
          adapter: getOkxAdapter(demoMode),
          channels: [createChannel("telegram")],
          dedupeStore: getGlobalDedupeStore(),
        },
      );

      // Disiplin logu — her durumda kayıt
      const je = output.journalEntry;
      logEvent(je.type as Parameters<typeof logEvent>[0], {
        pair: je.pair,
        direction: je.direction,
        score: je.score,
        decision: je.decision,
        source: je.source,
        reason: je.reason,
      });

      if (output.ok) {
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
          isPaper: demoMode,
          entryContext: {
            score: result.score,
            verdict: result.verdict,
            fgValue: fgValue ?? undefined,
            fundingRate: fundingResult?.fundingRate ?? undefined,
            drawdownTier: drawdownProtocol.tier,
          },
          orderId: output.tradeResult?.data?.orderId,
        });
        setShowConfirm(false);
      } else {
        setExecError(output.reasonHuman);
      }
    } catch (e) {
      setExecError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Forward Test Mode banner */}
      {forwardTestMode && (
        <div className="flex items-center gap-2 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/8 px-3 py-2">
          <span className="font-mono text-xs font-bold tracking-widest text-[#22C55E]">
            FWD TEST
          </span>
          <span className="text-text-t2 font-mono text-xs">
            Aktif — emirler simüle edilir, gerçek pozisyon açılmaz
          </span>
        </div>
      )}

      {/* Streak alert */}
      <StreakBanner />

      {/* Skor tazelik göstergesi */}
      <div className="flex items-center justify-between">
        <span className="text-text-t4 font-mono text-2xs tracking-wider">
          {latestScoreTime !== null
            ? `Skorlar güncellendi · ${scoreAge(latestScoreTime)} önce`
            : "Henüz hesaplanmadı"}
        </span>
        {computing && (
          <span className="text-brand font-mono text-2xs animate-pulse">⟳</span>
        )}
      </div>

      {/* Skor sıralaması */}
      <ScoreLeaderboard
        results={allResults}
        activePair={activePair}
        onSelect={setActivePair}
      />

      {/* GO sinyali geçmişi */}
      <GoSignalLog />

      {/* Pair grup filtresi */}
      <div className="flex flex-wrap gap-1">
        {(["all", "majors", "alts", "meme", "go", "watch"] as PairGroup[]).map((g) => {
          const label =
            g === "all" ? "Tüm" :
            g === "majors" ? "Majors" :
            g === "alts" ? "Alts" :
            g === "meme" ? "Meme" :
            g === "watch" ? `⭐${watchlistPairs.length > 0 ? ` (${watchlistPairs.length})` : ""}` :
            `GO${goPairs.length > 0 ? ` (${goPairs.length})` : ""}`;
          const isActive = pairGroup === g;
          const isGo = g === "go";
          const isWatch = g === "watch";
          return (
            <button
              key={g}
              onClick={() => {
                setPairGroup(g);
                const target = g === "go" ? goPairs : g === "watch" ? watchlistPairs : PAIR_GROUPS[g] ?? PAIRS;
                if (target.length > 0 && !target.includes(activePair)) {
                  setActivePair(target[0] as Pair);
                }
              }}
              className={[
                "px-2.5 py-1 rounded font-mono text-2xs font-medium transition-colors",
                isActive
                  ? isGo
                    ? "bg-green-500/20 text-green-400"
                    : isWatch
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-surface-s2 text-text-t1"
                  : isGo && goPairs.length > 0
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

      {/* Pair seçici — skor + verdict ile zenginleştirilmiş */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(displayPairs.length, 5)}, 1fr)` }}>
        {displayPairs.map((p) => {
          const pr = allResults[p];
          const v = pr?.verdict;
          const score = pr?.score;
          const dir = pr?.direction;
          const isActive = activePair === p;

          const verdictBorder =
            v === "go"
              ? "border-b-2 border-green-400"
              : v === "wait"
              ? "border-b-2 border-yellow-400"
              : v === "no"
              ? "border-b-2 border-red-400/50"
              : "border-b-2 border-transparent";

          const scoreColor =
            v === "go"
              ? "text-green-400"
              : v === "wait"
              ? "text-yellow-400"
              : "text-text-t4";

          const dirArrow =
            dir === "LONG" ? "▲" : dir === "SHORT" ? "▼" : "";

          const momentum = pairMomentum[p];
          const showMom = momentum !== undefined && Math.abs(momentum) >= 5;
          const momColor = (momentum ?? 0) > 0 ? "text-green-400" : "text-red-400";

          const isWatched = watchlistPairs.includes(p);
          return (
            <div key={p} className="relative group">
              <button
                onClick={() => setActivePair(p as Pair)}
                className={[
                  "w-full flex flex-col items-center rounded pt-1.5 pb-0.5 font-mono transition-colors",
                  verdictBorder,
                  isActive
                    ? "bg-surface-s2 text-text-t1"
                    : "text-text-t3 hover:text-text-t2",
                ].join(" ")}
              >
                <div className="relative flex items-center justify-center">
                  <span className="text-xs font-semibold tracking-wide">{p}</span>
                  {alarmedPairs.has(p) && (
                    <span className="absolute -top-0.5 -right-2 h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  <span className={`text-2xs tabular-nums ${isActive ? "text-text-t2" : scoreColor}`}>
                    {score !== undefined ? `${score}${dirArrow}` : "·"}
                  </span>
                  {showMom && (
                    <span className={`text-[8px] tabular-nums leading-none ${momColor}`}>
                      {(momentum ?? 0) > 0 ? "▲" : "▼"}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 h-[10px]">
                  <ScoreSparkline snapshots={scoreHistory[p] ?? []} />
                </div>
              </button>
              {/* Star/watchlist toggle — shows on hover or when starred */}
              <button
                onClick={(e) => { e.stopPropagation(); watchlistToggle(p as Pair); }}
                className={`absolute top-0 right-0 px-0.5 py-0.5 font-mono text-[9px] transition-opacity ${
                  isWatched
                    ? "opacity-100 text-amber-400"
                    : "opacity-0 group-hover:opacity-60 text-text-t4"
                }`}
                title={isWatched ? "İzlemeden çıkar" : "İzlemeye ekle"}
              >
                ★
              </button>
            </div>
          );
        })}
      </div>

      {/* Yükleniyor */}
      {!result && (
        <div className="bg-surface-s1 rounded-lg p-6 text-center font-mono text-sm text-text-t3">
          {computing ? "Hesaplanıyor..." : "Mum verisi bekleniyor..."}
        </div>
      )}

      {/* Sonuç */}
      {result && (
        <>
          <HistoricalEdge pair={activePair} />
          <LiveEdgeBadge pair={activePair} />
          <VerdictBadge
            verdict={result.verdict}
            signalType={result.pullbackActive ? "pullback" : "classic"}
          />
          <DirectionBadge
            direction={result.direction}
            confidence={result.dirConfidence}
          />
          <FundingBadge
            pair={activePair}
            direction={result.direction !== "NEUTRAL" ? result.direction : undefined}
          />
          <ScoreBar
            score={result.score}
            threshold={result.effectiveThreshold}
            goThreshold={result.goThreshold}
          />
          <QuickAlarm
            pair={activePair}
            livePrice={livePrice}
            direction={result.direction}
          />
          <ScoreHistoryChart snapshots={scoreHistory[activePair] ?? []} />
          <FlowAlignmentRow flow={flowResult} />
          <ScoreBreakdown sub={result.sub} reasons={result.reasons} />
          <BlocksList
            hardBlocks={result.blocks}
            softBlocks={result.softBlocks}
          />
          <ReasonsList reasons={result.reasons} />

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
            Emir gönderiliyor...
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreHistoryChart({ snapshots }: { snapshots: import("@/lib/store/scoreHistoryStore").ScoreSnapshot[] }) {
  const pts = snapshots.slice(-40);
  if (pts.length < 2) return null;

  const W = 320;
  const H = 36;
  const PAD = 2;
  const n = pts.length;
  const xStep = (W - PAD * 2) / (n - 1);

  function xOf(i: number) { return PAD + i * xStep; }
  function yOf(s: number) { return PAD + ((100 - s) / 100) * (H - PAD * 2); }

  // Color segments by verdict
  const segments: { d: string; color: string }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const color = p.verdict === "go" ? "#22c55e" : p.verdict === "wait" ? "#f59e0b" : "#ef4444";
    segments.push({
      d: `M${xOf(i - 1).toFixed(1)},${yOf(pts[i-1].score).toFixed(1)}L${xOf(i).toFixed(1)},${yOf(p.score).toFixed(1)}`,
      color,
    });
  }

  // Threshold line at score 90 (approximate go threshold)
  const yGo = yOf(90);

  const latest = pts[pts.length - 1];

  return (
    <div className="border-border bg-bg-card rounded-lg border px-3 pt-2 pb-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-text-t4 font-mono text-2xs tracking-widest uppercase">Score Trend</span>
        <span className="text-text-t4 font-mono text-2xs">{pts.length} snapshots</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* GO threshold line */}
        <line x1={PAD} y1={yGo} x2={W - PAD} y2={yGo}
          stroke="#22c55e" strokeWidth="0.5" strokeDasharray="3,3" strokeOpacity="0.35" />
        {/* Score line — verdict-colored segments */}
        {segments.map((seg, i) => (
          <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth="1.5" strokeOpacity="0.8" />
        ))}
        {/* End dot */}
        <circle
          cx={xOf(n - 1)}
          cy={yOf(latest.score)}
          r="2.5"
          fill={latest.verdict === "go" ? "#22c55e" : latest.verdict === "wait" ? "#f59e0b" : "#ef4444"}
        />
      </svg>
      {/* Y-axis labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-text-t4 font-mono text-2xs">{pts[0].ts ? new Date(pts[0].ts).toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"}) : ""}</span>
        <span className="text-text-t4 font-mono text-2xs">{latest.ts ? new Date(latest.ts).toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"}) : ""}</span>
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
