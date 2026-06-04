/**
 * WALL DETECTOR — Order book'ta anormal büyük seviye tespiti.
 *
 * Wall: ortalama notional'ın N katından büyük seviye.
 * Absorption: (ileride) ardışık snapshot'larda wall notional'ı azalıyorsa.
 */

import type { OrderBookSnapshot, OrderBookLevel } from "./orderbook";

export interface WallLevel {
  side: "bid" | "ask";
  price: number;
  notionalUsd: number;
  /** Ortalamaya oranı */
  strengthMultiple: number;
}

export interface WallDetectionResult {
  walls: WallLevel[];
  avgBidNotional: number;
  avgAskNotional: number;
}

function avgNotional(levels: OrderBookLevel[]): number {
  if (!levels.length) return 0;
  return levels.reduce((s, l) => s + l.notionalUsd, 0) / levels.length;
}

/**
 * snapshot içindeki bid ve ask seviyelerinden güçlü duvarları tespit eder.
 * @param minMultiple Ortalama notional'ın kaç katı olunca "wall" sayılır (varsayılan 3×)
 */
export function detectWalls(
  snapshot: OrderBookSnapshot,
  minMultiple = 3.0,
): WallDetectionResult {
  const avgBid = avgNotional(snapshot.bids);
  const avgAsk = avgNotional(snapshot.asks);
  const walls: WallLevel[] = [];

  for (const bid of snapshot.bids) {
    const mult = avgBid > 0 ? bid.notionalUsd / avgBid : 0;
    if (mult >= minMultiple) {
      walls.push({ side: "bid", price: bid.price, notionalUsd: bid.notionalUsd, strengthMultiple: mult });
    }
  }
  for (const ask of snapshot.asks) {
    const mult = avgAsk > 0 ? ask.notionalUsd / avgAsk : 0;
    if (mult >= minMultiple) {
      walls.push({ side: "ask", price: ask.price, notionalUsd: ask.notionalUsd, strengthMultiple: mult });
    }
  }

  walls.sort((a, b) => b.strengthMultiple - a.strengthMultiple);
  return { walls, avgBidNotional: avgBid, avgAskNotional: avgAsk };
}
