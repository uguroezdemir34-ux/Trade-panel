"use client";

/**
 * USE FLOW INTELLIGENCE — CVD + VPIN + SMC + Liq pipeline.
 *
 * useMemo mimarisi:
 *   useState+useEffect yerine useMemo kullanılır. Bu, setResult → re-render →
 *   trades değişti → effect tetiklendi → setResult döngüsünü tamamen ortadan kaldırır.
 *   Sonuç render sırasında senkron hesaplanır, ek render tetiklenmez.
 *
 * VPIN: tradeFeedStore'da kalıcı — her fresh trade batch'i seenIds dedup korumasıyla incremental ingest edilir.
 *
 * livePrice throttle (FAZ 2a): marketStore.prices[pair].last WS tick'inde
 * saniyenin altında değişiyor, ama bu pipeline'ın kendisi (CVD/VPIN/SMC +
 * likidasyon kümeleme) her tick'te yeniden hesaplanacak kadar hassas
 * olmasını gerektirmiyor — fiyat zaten LIVE_PRICE_THROTTLE_MS penceresi
 * içinde anlamlı ölçüde kaymıyor. useThrottledValue trailing-edge olduğu
 * için gerçek bir fiyat değişikliği asla bu pencereden fazla gecikmez —
 * sadece ara tick'ler atlanıyor, üretilen sonuç YANLIŞ/eski kalmıyor.
 */

import { useMemo } from "react";
import type { Pair } from "@/lib/constants/pairs";
import type { FlowIntelligenceResult } from "@/lib/orderflow/flowIntelligence";
import { enrichWithFlowIntelligence } from "@/lib/orderflow/flowIntelligence";
import { useTradeFeedStore, selectFeed } from "@/lib/store/tradeFeedStore";
import { useCandleStore, EMPTY_CANDLES } from "@/lib/store/candleStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useLiqFeedStore } from "@/lib/store/liqFeedStore";
import { useThrottledValue } from "./useThrottledValue";

const LIVE_PRICE_THROTTLE_MS = 500;

const EMPTY_TRADES: readonly import("@/lib/orderflow/types").Trade[] = [];
const EMPTY_LIQ_EVENTS: import("@/lib/store/liqFeedStore").LiqEvent[] = [];
import { buildLiquidationMapFromEvents } from "@/lib/orderflow/liquidationMap";
import type { Candle as SmcCandle } from "@/lib/orderflow/smc";
import type { Candle as OkxCandle } from "@/lib/okx/candles";
import type { SignalDirection } from "@/lib/orderflow/flowVerdict";

const MIN_REAL_LIQ_EVENTS = 20;

function toSmcCandle(c: OkxCandle): SmcCandle {
  return { time: c.ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
}

export function useFlowIntelligence(
  pair: Pair,
  signalDirection: SignalDirection,
): FlowIntelligenceResult | null {
  const feed = useTradeFeedStore(selectFeed(pair));
  const trades = feed?.buffer?.items ?? EMPTY_TRADES;
  const vpinState = feed?.vpinState;
  const candles1hRaw = useCandleStore((s) => s.candles[`${pair}_1h`]);
  const candles1h = candles1hRaw ?? EMPTY_CANDLES;
  const livePriceRaw = useMarketStore((s) => s.prices[pair]?.last ?? null);
  const livePrice = useThrottledValue(livePriceRaw, LIVE_PRICE_THROTTLE_MS);
  const liqEvents = useLiqFeedStore((s) => s.events[pair] ?? EMPTY_LIQ_EVENTS);

  return useMemo(() => {
    if (trades.length === 0 || !livePrice) return null;

    const smcCandles: SmcCandle[] = (candles1h as OkxCandle[]).map(toSmcCandle);

    // Gerçek liq feed yeterliyse kullan, yoksa fallback (OHLCV tahmini)
    const prebuiltLiqMap =
      liqEvents.length >= MIN_REAL_LIQ_EVENTS
        ? buildLiquidationMapFromEvents(pair, liqEvents, livePrice)
        : undefined;

    return enrichWithFlowIntelligence(
      pair,
      signalDirection,
      trades,
      smcCandles,
      livePrice,
      vpinState,
      Date.now(),
      prebuiltLiqMap,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, signalDirection, trades, candles1h, livePrice, liqEvents, vpinState]);
}
