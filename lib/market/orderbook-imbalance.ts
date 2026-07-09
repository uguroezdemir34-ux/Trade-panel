/**
 * ORDER BOOK IMBALANCE — top-5 derinlikten tek taraflı "duvar" tespiti.
 *
 * bid/ask taraflarının USD derinliğini toplar, oranını hesaplar. Bir taraf
 * diğerinden WALL_RATIO_THRESHOLD kat ağırsa "duvar" (wallSide) işaretlenir.
 *
 * Saf fonksiyon — I/O yok. lib/market/oi-velocity.ts ile aynı desen.
 */

import type { OrderBookSnapshot, OrderBookLevel } from "@/lib/okx/orderbook";

export type WallSide = "bid" | "ask" | "neutral";

export interface OrderBookImbalanceResult {
  bidDepthUsd: number;
  askDepthUsd: number;
  /** Ağır basan tarafın diğerine oranı, her zaman >= 1 */
  ratio: number;
  wallSide: WallSide;
  ts: number;
}

const WALL_RATIO_THRESHOLD = 3;

function depthUsd(levels: readonly OrderBookLevel[]): number {
  return levels.reduce((sum, l) => sum + l.price * l.size, 0);
}

export function computeOrderBookImbalance(
  snap: OrderBookSnapshot | null | undefined,
): OrderBookImbalanceResult | null {
  if (!snap) return null;

  const bidDepthUsd = depthUsd(snap.bids);
  const askDepthUsd = depthUsd(snap.asks);
  if (bidDepthUsd <= 0 || askDepthUsd <= 0) return null;

  const bidHeavier = bidDepthUsd >= askDepthUsd;
  const ratio = bidHeavier ? bidDepthUsd / askDepthUsd : askDepthUsd / bidDepthUsd;

  const wallSide: WallSide =
    ratio < WALL_RATIO_THRESHOLD ? "neutral" : bidHeavier ? "bid" : "ask";

  return {
    bidDepthUsd,
    askDepthUsd,
    ratio: parseFloat(ratio.toFixed(4)),
    wallSide,
    ts: snap.ts,
  };
}
