/**
 * ORDER BOOK IMBALANCE — fetch edilen derinlikten tek taraflı "duvar" tespiti.
 *
 * bid/ask taraflarının USD derinliğini toplar, oranını hesaplar. Bir taraf
 * diğerinden WALL_RATIO_THRESHOLD kat ağırsa "duvar" (wallSide) işaretlenir.
 *
 * wallDistancePct MIN_WALL_DISTANCE_PCT'in altındaysa (duvar best bid/ask'a
 * yapışıksa — mid-price'a mesafesi anlamsız derecede küçükse) wallPrice/
 * wallSizeUsd/wallDistancePct null'a çekilir; wallSide/ratio etkilenmez,
 * caller'daki mevcut null-guard genel mesaja düşer (bkz. AnomalyBadge.tsx).
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
  /**
   * "Balina İzleri" genişletmesi — duvarın (dominant taraftaki tek en büyük
   * seviyenin) fiyatı/büyüklüğü/mesafesi. wallSide "neutral" ise veya top-5
   * içinde en iyi bid/ask fiyatı okunamıyorsa null (geriye dönük uyumlu —
   * eski çağıranlar bu alanları hiç okumasa da kırılmaz).
   */
  wallPrice: number | null;
  wallSizeUsd: number | null;
  /** Orta fiyata (best bid/ask ortalaması) göre mutlak yüzde mesafe */
  wallDistancePct: number | null;
  ts: number;
}

const WALL_RATIO_THRESHOLD = 3;
/** Duvarın mid-price'a en az bu kadar (%) uzak olması gerekir, yoksa
 *  best bid/ask'a yapışık bir seviye "duvar" sayılıp anlamsız ~0 mesafe
 *  gösterilir (bkz. dosya başı yorumu). */
const MIN_WALL_DISTANCE_PCT = 0.05;

function depthUsd(levels: readonly OrderBookLevel[]): number {
  return levels.reduce((sum, l) => sum + l.price * l.size, 0);
}

/** Bir taraftaki (bids veya asks) tek en büyük USD değerli seviyeyi bulur. */
function findWallLevel(levels: readonly OrderBookLevel[]): OrderBookLevel | null {
  if (levels.length === 0) return null;
  return levels.reduce((max, l) => (l.price * l.size > max.price * max.size ? l : max), levels[0]);
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

  let wallPrice: number | null = null;
  let wallSizeUsd: number | null = null;
  let wallDistancePct: number | null = null;

  if (wallSide !== "neutral") {
    const dominantLevels = wallSide === "bid" ? snap.bids : snap.asks;
    const wallLevel = findWallLevel(dominantLevels);
    const bestBid = snap.bids[0]?.price;
    const bestAsk = snap.asks[0]?.price;
    if (wallLevel && bestBid && bestAsk) {
      const midPrice = (bestBid + bestAsk) / 2;
      const distancePct = midPrice > 0 ? Math.abs(((wallLevel.price - midPrice) / midPrice) * 100) : null;
      if (distancePct !== null && distancePct >= MIN_WALL_DISTANCE_PCT) {
        wallPrice = wallLevel.price;
        wallSizeUsd = wallLevel.price * wallLevel.size;
        wallDistancePct = distancePct;
      }
    }
  }

  return {
    bidDepthUsd,
    askDepthUsd,
    ratio: parseFloat(ratio.toFixed(4)),
    wallSide,
    wallPrice,
    wallSizeUsd,
    wallDistancePct,
    ts: snap.ts,
  };
}
