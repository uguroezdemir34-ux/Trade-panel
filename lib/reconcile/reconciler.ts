/**
 * TRADE RECONCILER — Matches local TradeSnapshots against OKX closed orders.
 *
 * Matching priority:
 *   1. Primary:   trade.orderId === okxOrder.ordId
 *   2. Secondary: same pair + direction + |openedAt - createdAtMs| < 10 min + similar sz
 */

import type { TradeSnapshot } from "@/lib/trades/types";
import type { OkxClosedOrder } from "@/lib/okx/fills";
import type { Pair } from "@/lib/constants/pairs";

export interface ReconcileMatch {
  tradeId: string;
  okxOrderId: string;
  /** Local P&L stored in the snapshot */
  localPnlUsd: number;
  /** P&L reported by OKX */
  okxPnlUsd: number;
  okxExitPrice: number;
  okxFilledAtMs: number;
  okxFeeUsd: number;
  /** true when snapshot needs updating (open → closed, or P&L delta > $0.01) */
  needsUpdate: boolean;
}

export interface ReconcileOrphan {
  ordId: string;
  pair: Pair | null;
  direction: "LONG" | "SHORT" | null;
  pnlUsd: number;
  feeUsd: number;
  avgPx: number;
  filledAtMs: number;
}

export interface ReconcileResult {
  matched: ReconcileMatch[];
  orphans: ReconcileOrphan[];
  syncedAt: number;
}

const PROXIMITY_MS = 10 * 60 * 1000; // 10 minutes
const PNL_DELTA_THRESHOLD = 0.01; // $0.01

export function reconcile(
  trades: TradeSnapshot[],
  okxOrders: OkxClosedOrder[],
): ReconcileResult {
  const matched: ReconcileMatch[] = [];
  const matchedOrdIds = new Set<string>();

  for (const okx of okxOrders) {
    // 1. Primary match: orderId
    let trade = trades.find(
      (t) => t.orderId != null && t.orderId === okx.ordId,
    );

    // 2. Secondary match: pair + direction + time proximity
    if (!trade && okx.pair != null && okx.direction != null) {
      trade = trades.find(
        (t) =>
          t.orderId == null &&
          t.pair === okx.pair &&
          t.direction === okx.direction &&
          Math.abs(t.openedAt - okx.createdAtMs) < PROXIMITY_MS,
      );
    }

    if (!trade) continue;

    const localPnlUsd = trade.exit?.pnlUsd ?? 0;
    const pnlDelta = Math.abs(localPnlUsd - okx.pnlUsd);
    const isOpen = trade.status === "open" || trade.status === "pending";

    matchedOrdIds.add(okx.ordId);
    matched.push({
      tradeId: trade.id,
      okxOrderId: okx.ordId,
      localPnlUsd,
      okxPnlUsd: okx.pnlUsd,
      okxExitPrice: okx.avgPx,
      okxFilledAtMs: okx.filledAtMs,
      okxFeeUsd: okx.feeUsd,
      needsUpdate: isOpen || pnlDelta > PNL_DELTA_THRESHOLD,
    });
  }

  const orphans: ReconcileOrphan[] = okxOrders
    .filter((o) => !matchedOrdIds.has(o.ordId))
    .map((o) => ({
      ordId: o.ordId,
      pair: o.pair,
      direction: o.direction,
      pnlUsd: o.pnlUsd,
      feeUsd: o.feeUsd,
      avgPx: o.avgPx,
      filledAtMs: o.filledAtMs,
    }));

  return { matched, orphans, syncedAt: Date.now() };
}
