"use client";

/**
 * BOT MODE HOOK — Otomatik GO sinyal yürütme.
 *
 * Tetik: herhangi bir çiftte non-GO → GO geçişi
 * Kontroller (sırayla):
 *   1. botModeEnabled
 *   2. Yön NEUTRAL değil
 *   3. score >= botModeMinScore
 *   4. drawdownProtocol.tier !== "locked"
 *   5. Bugünkü trade sayısı < maxTradesPerDay
 *   6. Çift için açık pozisyon yok
 *   7. Candle + fiyat verisi mevcut (ATR hesabı için)
 *   8. Per-pair cooldown (5 dak) — GO etrafında titreşmeye karşı
 *
 * Yürütme: orchestrate() → source: "bot" → openPending()
 * Tüm hatalar sessizce loglanır, hook throw etmez.
 */

import { useEffect, useRef } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useCandleStore } from "@/lib/store/candleStore";
import { orchestrate } from "@/lib/orchestrator/router";
import { getAdapter } from "@/lib/exchange";
import { createChannel } from "@/lib/notify/registry";
import { getGlobalDedupeStore } from "@/lib/orchestrator/dedupe";
import { computePositionSize } from "@/lib/sizer/position";
import { atr } from "@/lib/indicators/atr";
import { adx } from "@/lib/indicators/adx";
import { findSwingLevels } from "@/lib/sr/swing";
import { toIndicatorCandle } from "@/lib/okx/candles";
import { getBucketStats } from "@/lib/bucket/stats";
import { useAccountStore } from "@/lib/store/accountStore";
import { useRiskStore } from "@/lib/store/riskStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useMarketStore } from "@/lib/store/marketStore";
import type { Pair } from "@/lib/constants/pairs";
import type { Verdict } from "@/lib/score/orchestrator";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per pair

export function useBotMode(): void {
  const results = useScoreStore((s) => s.results);
  const botModeEnabled = useSettingsStore((s) => s.botModeEnabled);
  const botModeMinScore = useSettingsStore((s) => s.botModeMinScore);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const maxTradesPerDay = useSettingsStore((s) => s.maxTradesPerDay);

  const prevVerdicts = useRef<Partial<Record<Pair, Verdict>>>({});
  const lastFired = useRef<Partial<Record<Pair, number>>>({});

  useEffect(() => {
    if (!botModeEnabled) {
      // Still track verdicts so we don't fire on stale transitions when enabled
      const pairs = Object.keys(results) as Pair[];
      for (const pair of pairs) {
        const result = results[pair];
        if (result) prevVerdicts.current[pair] = result.verdict;
      }
      return;
    }

    const now = Date.now();
    const pairs = Object.keys(results) as Pair[];

    for (const pair of pairs) {
      const result = results[pair];
      if (!result) continue;

      const prev = prevVerdicts.current[pair];
      const curr = result.verdict;

      // Only fire on non-GO → GO transition (prev must be known to avoid first-render fires)
      if (curr === "go" && prev !== "go" && prev !== undefined) {
        const lastTime = lastFired.current[pair] ?? 0;
        if (now - lastTime >= COOLDOWN_MS) {
          // Score threshold check
          if (result.score >= botModeMinScore) {
            lastFired.current[pair] = now;
            void runBotExecution(pair, result, demoMode, maxTradesPerDay, now);
          }
        }
      }

      prevVerdicts.current[pair] = curr;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, botModeEnabled, botModeMinScore]);
}

async function runBotExecution(
  pair: Pair,
  result: ReturnType<typeof useScoreStore.getState>["results"][Pair],
  demoMode: boolean,
  maxTradesPerDay: number,
  now: number,
): Promise<void> {
  if (!result) return;
  if (result.direction !== "LONG" && result.direction !== "SHORT") return;

  // Read all state via getState() — avoids stale closure from hook render
  const { drawdownProtocol } = useAccountStore.getState();
  const { btcCooldownUntil, btcSelfCooldownUntil, logEvent } = useRiskStore.getState();
  const { trades, openPending } = useTradesStore.getState();
  const { prices } = useMarketStore.getState();
  const { balanceTotal, balanceFree } = useAccountStore.getState();
  const candleState = useCandleStore.getState();

  // Preflight: drawdown locked
  if (drawdownProtocol.tier === "locked") return;

  // Preflight: daily trade count
  const today = new Date(now);
  const todayTrades = trades.filter((tr) => {
    const d = new Date(tr.openedAt);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });
  if (todayTrades.length >= maxTradesPerDay) return;

  // Preflight: no existing open position for this pair
  const hasOpen = trades.some((tr) => tr.pair === pair && tr.status === "open");
  if (hasOpen) return;

  // Get live price
  const livePrice = prices[pair]?.last ?? null;
  if (!livePrice) return;

  // Get candles for position sizing
  const candles1h = candleState.candles[`${pair}_1h`] ?? [];
  const candles4h = candleState.candles[`${pair}_4h`] ?? [];
  if (candles1h.length < 15) return;

  const atrValue = atr(candles1h.map(toIndicatorCandle), { period: 14 });
  if (!atrValue) return;

  const adxValue =
    candles1h.length >= 29
      ? (adx(candles1h.map(toIndicatorCandle), 14)?.adx ?? null)
      : null;

  const swingLevels =
    candles4h.length >= 10
      ? findSwingLevels(candles4h.map(toIndicatorCandle), 20, 2)
      : { swingLow: null, swingHigh: null };

  // Bucket stats for risk sizing
  const closedTrades = trades
    .filter((tr) => tr.status === "closed" && tr.exit != null && tr.pair === pair)
    .map((tr) => ({ score: tr.entryContext.score, pnlUsd: tr.exit!.pnlUsd }));
  const bucketStats = getBucketStats(result.score, closedTrades);

  // Compute position size
  const sizing = computePositionSize({
    pair,
    direction: result.direction,
    px: livePrice,
    atr: atrValue,
    adx1h: adxValue,
    swingLow: swingLevels.swingLow,
    swingHigh: swingLevels.swingHigh,
    balance: { total: balanceTotal, free: balanceFree },
    drawdownProtocol,
    bucket: bucketStats,
    score: result.score,
  });

  // Block if sizing says blocked
  if (sizing.warnLevel === "blocked") return;

  try {
    const output = await orchestrate(
      {
        signal: result,
        pair,
        livePrice,
        qty: sizing.qty,
        stopPrice: sizing.stop.stopPrice,
        takeProfitPrice: sizing.tp.tp1Price,
        leverage: sizing.leverage,
        marginMode: "cross",
        source: "bot",
        accountState: {
          drawdownProtocol,
          btcCooldownUntil,
          btcSelfCooldownUntil,
          todayTradeCount: todayTrades.length,
          maxTradesPerDay,
        },
      },
      {
        adapter: getAdapter(demoMode),
        channels: [createChannel("telegram")],
        dedupeStore: getGlobalDedupeStore(),
        now,
      },
    );

    // Log discipline entry
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
        pair,
        direction: result.direction,
        entryPrice: livePrice,
        qty: sizing.qty,
        leverage: sizing.leverage,
        stopPrice: sizing.stop.stopPrice,
        takeProfit1: sizing.tp.tp1Price,
        takeProfit2: sizing.tp.tp2Price,
        riskAmountUsd: sizing.risk.riskUsd,
        isPaper: demoMode,
        source: "bot",
        entryContext: {
          score: result.score,
          verdict: result.verdict,
          drawdownTier: drawdownProtocol.tier,
        },
        orderId: output.tradeResult?.data?.orderId,
      });
    }
  } catch {
    // Bot mode errors are silent — do not disrupt the app
  }
}
