/**
 * SCORE ENGINE HOOK — candleStore tetiklendiğinde ScoreInput oluşturup
 * computeScore çalıştırır, sonucu scoreStore'a yazar.
 *
 * Render optimizasyonu:
 *   - Yalnızca candleStore.candles değiştiğinde (her ~30s) hesaplar
 *   - Diğer store'lar getState() ile okunur — subscription yok, re-render yok
 */

"use client";

import { useEffect } from "react";

// --- debug instrumentation (?debug=1 only) ---
function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("debug") === "1"; }
  catch { return false; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function perfLog(entry: Record<string, unknown>): void {
  if (!isDebug()) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__PERF_LOG__) w.__PERF_LOG__ = [];
  w.__PERF_LOG__.push({ ...entry, _ts: Date.now() });
}
// --- end debug ---
import { PAIRS } from "@/lib/constants/pairs";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useMacroStore } from "@/lib/store/macroStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { usePositionStore } from "@/lib/store/positionStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { composeScoreInput } from "@/lib/score/composeScoreInput";
import { computeScore } from "@/lib/score/orchestrator";
import { inferDirection, type DirectionInput } from "@/lib/score/direction";
import { detectSRLevels } from "@/lib/sr/detect";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { oiVelocityScoreOrZero } from "@/lib/market/oi-velocity";
import { computeMtfTrend } from "@/lib/market/mtfTrend";
import { detectLiquiditySweep } from "@/lib/sr/sweep";
import { SR_SCALE_FACTOR } from "@/lib/score/version";
import { adx as computeAdx } from "@/lib/indicators/adx";
import type { Pair } from "@/lib/constants/pairs";

function yieldToEventLoop(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// Skip-retry fast path throttle (modül seviyesi — candleStore equality fn'i
// bir hook değil, useRef kullanamıyor). Kalıcı skip'te kalan pariteler
// (örn. candle verisi hiç gelmeyen pair'ler) yüzünden fast path'in
// candleStore'un HER güncellemesinde (WS canlı mum tick'leri dahil) motoru
// tetiklemesini önler — throttle penceresi dolmadıysa normal candle
// ts/confirm karşılaştırmasına düşülür, gerçek bir değişiklik yine yakalanır.
let _lastSkipRecheckAt = 0;
const SKIP_RECHECK_THROTTLE_MS = 3_000;

export function useScoreEngine(): void {
  // Trigger: only when 15m/1h/4h last candle timestamps/confirm flags change.
  // Prevents score recomputation on 1d-only polls or identity-equal updates.
  const candles = useCandleStore(
    (s) => s.candles,
    (prev, next) => {
      // Fast path: any pair never scored OR skipped → trigger immediately so
      // insufficient-data pairs get re-evaluated every cycle instead of
      // waiting for their next candle ts/confirm change (which may be up to
      // 60 minutes away for 1h bars). undefined = never scored, null =
      // skipped (composeScoreInput returned null) — both should retry.
      const { results } = useScoreStore.getState();
      if (PAIRS.some((p) => results[p] === undefined || results[p] === null)) {
        const now = Date.now();
        if (now - _lastSkipRecheckAt >= SKIP_RECHECK_THROTTLE_MS) {
          _lastSkipRecheckAt = now;
          return false;
        }
        // Throttled — kalıcı skip'te kalan pair(ler) yüzünden burada spin
        // etmek yerine aşağıdaki normal candle ts/confirm karşılaştırmasına
        // düş, gerçek bir veri değişikliği yine yakalanır.
      }

      for (const pair of PAIRS) {
        for (const tf of ["15m", "1h", "4h"] as const) {
          const key = `${pair}_${tf}` as const;
          const p = prev[key];
          const n = next[key];
          if (p === n) continue;
          if (!p || !n || p.length !== n.length) return false;
          const pL = p[p.length - 1];
          const nL = n[n.length - 1];
          if (!pL || !nL) return false;
          if (pL.ts !== nL.ts || pL.confirm !== nL.confirm) return false;
        }
      }
      return true;
    },
  );
  const setResult  = useScoreStore((s) => s.setResult);
  const setSkipped = useScoreStore((s) => s.setSkipped);
  const scorerWeights = useSettingsStore((s) => s.scorerWeights);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const engineT0 = isDebug() ? performance.now() : 0;

    // Snapshot — subscription yok, re-render tetiklemiyor
    const marketStore = useMarketStore.getState();
    const macroStore = useMacroStore.getState();
    const riskStore = useRiskStore.getState();
    const accountStore = useAccountStore.getState();
    const positionStore = usePositionStore.getState();
    const tradesStore = useTradesStore.getState();

    // BTC 1H ADX — piyasa geneli chop tespiti (tüm çiftler için ortak)
    const btcCandles1h = candles["BTC_1h"] ?? EMPTY_CANDLES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const btcAdx1h = btcCandles1h.length >= 14
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (computeAdx((btcCandles1h as any[]).map(toIndicatorCandle), 14)?.adx ?? null)
      : null;

    // BTC S/R proximity gate — BTC kendi seviyesine ≤%0.5 yakınsa altcoin threshold +8
    const btcCandles4h = candles["BTC_4h"] ?? EMPTY_CANDLES;
    const btcPrice = marketStore.prices["BTC"]?.last ?? null;
    let btcNearSR = false;
    if (btcPrice && btcPrice > 0 && btcCandles4h.length >= 10 && btcCandles1h.length >= 10) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const btcC4h = (btcCandles4h as any[]).map(toIndicatorCandle);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const btcC1h = (btcCandles1h as any[]).map(toIndicatorCandle);
      const btcSR = detectSRLevels(btcC4h, btcC1h, btcPrice, "NEUTRAL", null);
      const distR = btcSR.levels.nearest_resistance?.distance_pct ?? Infinity;
      const distS = btcSR.levels.nearest_support?.distance_pct ?? Infinity;
      btcNearSR = Math.min(distR, distS) <= 0.5;
    }

    void (async () => {
    for (const pair of PAIRS) {
      if (cancelled) return;
      const candles4h = candles[`${pair}_4h`] ?? EMPTY_CANDLES;
      const candles1h = candles[`${pair}_1h`] ?? EMPTY_CANDLES;
      const candles15m = candles[`${pair}_15m`] ?? EMPTY_CANDLES;
      const candles1d = candles[`${pair}_1d`] ?? EMPTY_CANDLES;

      const livePrice = marketStore.prices[pair]?.last ?? null;
      const fg = macroStore.fgValue ?? 50;
      const fundingResult = macroStore.funding[pair as Pair] ?? null;
      const fundingRate = fundingResult?.fundingRate ?? null;

      const oiVelocityResult = macroStore.oiVelocity[pair as Pair] ?? null;
      const oiVelocityScore = oiVelocityScoreOrZero(oiVelocityResult);

      const openPositions = positionStore.positions.map((p) => ({
        pair: p.pair,
        direction: p.direction as "LONG" | "SHORT",
      }));

      const trades = tradesStore.trades
        .filter((t) => t.status === "closed" && t.exit != null)
        .map((t) => ({
          score: t.entryContext.score,
          pnlUsd: t.exit!.pnlUsd,
          closedAt: t.exit!.closedAt,
        }));

      const protocol = accountStore.drawdownProtocol;
      const drawdownProtocol = {
        tier: protocol.tier,
        minScore:
          protocol.tier === "locked"
            ? 999
            : protocol.tier === "restricted"
              ? 90
              : protocol.tier === "caution"
                ? 85
                : 80,
        label: protocol.label,
        reason: "",
      };

      // Pre-compute indicator candles (reused for sweep detection + S/R)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c4hInd = (candles4h as any[]).map(toIndicatorCandle);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c1hInd = (candles1h as any[]).map(toIndicatorCandle);
      const sweepDetection = detectLiquiditySweep(c1hInd, c4hInd);
      const sweep15m = sweepDetection
        ? {
            type: (sweepDetection.direction === "LONG" ? "bullish_sweep" : "bearish_sweep") as
              | "bullish_sweep"
              | "bearish_sweep",
            strength: sweepDetection.wickRatio,
          }
        : { type: null as null, strength: 0 };

      const input = composeScoreInput({
        pair,
        livePrice,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles4h: candles4h as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles1h: candles1h as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles15m: candles15m as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candles1d: candles1d as any,
        fg,
        eventSkipUntil: null,
        btcCooldownUntil: riskStore.btcCooldownUntil || null,
        btcCooldownReason: riskStore.btcCooldownReason,
        btcSelfCooldownUntil: riskStore.btcSelfCooldownUntil || null,
        lockReleasedAt: riskStore.lockReleasedAt || null,
        openPositions,
        drawdownProtocol,
        trades,
        fundingRate,
        oiVelocityScore,
        oiVelocityResult,
        btcAdx1h,
        btcNearSR,
        srModifier: 0,
        sweep15m,
        timeQuality: { quality: 1, reason: "" },
        now,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mtfResult = computeMtfTrend(pair as Pair, candles1h as any, candles4h as any, candles1d as any);

      if (input) {
        try {
          // Pre-compute direction → S/R modifier (same pattern as server)
          const { direction } = inferDirection({
            px15: input.px15,
            px1h: input.px,
            px4h: input.px4h,
            ema21_15m: input.ema21_15m,
            ema50_1h: input.ema50_1h,
            ema200_1h: input.ema200_1h,
            ema50_4h: input.ema50_4h,
          } as DirectionInput);
          const srResult = detectSRLevels(c4hInd, c1hInd, input.px, direction, input.volRatio);
          const srModifier = srResult.modifier * SR_SCALE_FACTOR;
          const scoreT0 = isDebug() ? performance.now() : 0;
          const result = computeScore({ ...input, srModifier, scorerWeights: scorerWeights ?? null, mtfResult });
          perfLog({ type: "score_compute", pair, durationMs: +((performance.now() - scoreT0).toFixed(2)) });
          setResult(pair as Pair, result, now);
        } catch {
          // Ignore scoring errors — stale result remains until next candle update
        }
      } else {
        // composeScoreInput returned null: insufficient candles for this pair.
        // Write null sentinel so equality fn stops treating this pair as
        // "never scored" — prevents perpetual re-trigger on data-starved pairs.
        setSkipped(pair as Pair, now);
      }
      await yieldToEventLoop();
    }
    perfLog({ type: "engine_cycle", totalMs: +((performance.now() - engineT0).toFixed(1)), pairs: PAIRS.length });
    })();
    return () => { cancelled = true; };
  }, [candles, setResult, scorerWeights]);
}
