/**
 * OKX FILLS — Fetches closed SWAP orders from OKX trade history.
 *
 * Uses /api/v5/trade/orders-history (last 7 days) via the existing OKX proxy.
 * Only returns closing orders (realized P&L ≠ 0), i.e. position close events.
 *
 * Direction mapping for hedge-mode perpetual SWAP:
 *   side=sell + posSide=long  → closed a LONG  → direction=LONG
 *   side=buy  + posSide=short → closed a SHORT → direction=SHORT
 */

import { PAIRS, type Pair } from "@/lib/constants/pairs";

export interface OkxClosedOrder {
  ordId: string;
  instId: string;
  pair: Pair | null;
  /** Direction of the position that was closed */
  direction: "LONG" | "SHORT" | null;
  sz: number;
  avgPx: number;
  pnlUsd: number;
  feeUsd: number;
  createdAtMs: number;
  filledAtMs: number;
}

interface RawOrder {
  ordId: string;
  instId: string;
  side: string;
  posSide: string;
  sz: string;
  avgPx: string;
  pnl: string;
  fee: string;
  state: string;
  cTime: string;
  fillTime: string;
}

interface OkxResponse {
  code: string;
  data: RawOrder[];
  msg: string;
}

function instIdToPair(instId: string): Pair | null {
  // "BTC-USDT-SWAP" → "BTC"
  const base = instId.split("-")[0] ?? "";
  return (PAIRS as readonly string[]).includes(base) ? (base as Pair) : null;
}

function deriveDirection(side: string, posSide: string): "LONG" | "SHORT" | null {
  if (posSide === "long" && side === "sell") return "LONG";
  if (posSide === "short" && side === "buy") return "SHORT";
  // net mode (one-way): infer from side (sell = was long, buy = was short)
  if (posSide === "net") return side === "sell" ? "LONG" : "SHORT";
  return null;
}

/**
 * Fetch last `limit` filled SWAP orders from OKX and return only closing orders.
 * Closing orders have realized P&L ≠ 0.
 *
 * @param demoMode Use demo credentials (X-OKX-Mode header)
 * @param limit   Max orders to fetch per request (1-100)
 */
export async function fetchOkxClosedOrders(
  demoMode: boolean,
  limit = 100,
): Promise<OkxClosedOrder[]> {
  const url = `/api/okx/api/v5/trade/orders-history?instType=SWAP&state=filled&limit=${limit}`;

  let raw: OkxResponse;
  try {
    const res = await fetch(url, {
      headers: { "X-OKX-Mode": demoMode ? "demo" : "prod" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = (await res.json()) as OkxResponse;
  } catch (e) {
    throw new Error(`OKX orders-history fetch failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (raw.code !== "0") {
    throw new Error(`OKX API error ${raw.code}: ${raw.msg}`);
  }

  return raw.data
    .filter((o) => o.state === "filled" && parseFloat(o.pnl) !== 0)
    .map((o): OkxClosedOrder => ({
      ordId: o.ordId,
      instId: o.instId,
      pair: instIdToPair(o.instId),
      direction: deriveDirection(o.side, o.posSide),
      sz: parseFloat(o.sz) || 0,
      avgPx: parseFloat(o.avgPx) || 0,
      pnlUsd: parseFloat(o.pnl) || 0,
      feeUsd: Math.abs(parseFloat(o.fee) || 0),
      createdAtMs: parseInt(o.cTime, 10) || 0,
      filledAtMs: parseInt(o.fillTime, 10) || 0,
    }));
}
