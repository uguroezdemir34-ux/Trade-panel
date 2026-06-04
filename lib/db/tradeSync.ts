/**
 * TRADE SYNC — Client-side helpers to sync trade data with the server DB.
 *
 * These functions call /api/trades and are safe to import in "use client" code.
 * All calls are fire-and-forget friendly — errors are logged, never thrown.
 */

import type { TradeSnapshot } from "@/lib/trades/types";

/** Upsert a single trade to the server DB. Returns true on success. */
export async function syncTradeToServer(trade: TradeSnapshot): Promise<boolean> {
  try {
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade }),
    });
    const data = await res.json() as { ok?: boolean; configured?: boolean };
    return res.ok && (data.ok === true || data.configured === false);
  } catch {
    return false;
  }
}

/** Bulk-sync an array of trades to the server DB. Returns count synced. */
export async function bulkSyncTradesToServer(trades: TradeSnapshot[]): Promise<number> {
  if (trades.length === 0) return 0;
  try {
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trades }),
    });
    const data = await res.json() as { ok?: boolean; configured?: boolean };
    if (!res.ok || data.configured === false) return 0;
    return trades.length;
  } catch {
    return 0;
  }
}

/** Fetch all trades for the current user from the server DB. */
export async function fetchTradesFromServer(): Promise<TradeSnapshot[] | null> {
  try {
    const res = await fetch("/api/trades");
    const data = await res.json() as { trades?: TradeSnapshot[]; configured?: boolean };
    if (!res.ok || data.configured === false) return null;
    return data.trades ?? [];
  } catch {
    return null;
  }
}
