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
import type { Pair } from "@/lib/constants/pairs";

export function useScoreEngine(): void {
  // Trigger: only when 15m/1h/4h last candle timestamps/confirm flags change.
  // Prevents score recomputation on 1d-only polls or identity-equal updates.
  const candles = useCandleStore(
    (s) => s.candles,
    (prev, next) => {
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
  const setResult = useScoreStore((s) => s.setResult);
  const scorerWeights = useSettingsStore((s) => s.scorerWeights);

  useEffect(() => {
    const now = Date.now();

    // Snapshot — subscription yok, re-render tetiklemiyor
    const marketStore = useMarketStore.getState();
    const macroStore = useMacroStore.getState();
    const riskStore = useRiskStore.getState();
    const accountStore = useAccountStore.getState();
    const positionStore = usePositionStore.getState();
    const tradesStore = useTradesStore.getState();

    for (const pair of PAIRS) {
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
          const result = computeScore({ ...input, srModifier, scorerWeights: scorerWeights ?? null, mtfResult });
          setResult(pair as Pair, result, now);
        } catch {
          // Ignore scoring errors — stale result remains until next candle update
        }
      }
    }
  }, [candles, setResult, scorerWeights]);
}
