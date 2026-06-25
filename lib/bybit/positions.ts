import type { Position } from "@/lib/okx/positions";
import type { Pair } from "@/lib/constants/pairs";
import { PAIRS } from "@/lib/constants/pairs";

interface BybitPositionRow {
  symbol: string;
  side: string;
  size: string;
  avgPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  liqPrice: string;
  leverage: string;
  positionIdx: number;
  positionStatus: string;
  stopLoss: string;
  takeProfit: string;
  createdTime: string;
}

interface BybitProxyResponse {
  ok: boolean;
  data: unknown;
  retCode?: number;
  retMsg?: string;
}

function stripUsdtSuffix(symbol: string): string {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

function extractPair(symbol: string): Pair | null {
  const base = stripUsdtSuffix(symbol);
  if ((PAIRS as readonly string[]).includes(base)) return base as Pair;
  return null;
}

function num(s: string | undefined, fallback = 0): number {
  if (!s) return fallback;
  const n = parseFloat(s);
  return isFinite(n) ? n : fallback;
}

function parseRow(row: BybitPositionRow): Position | null {
  if (row.side === "None" || parseFloat(row.size) === 0) return null;

  const pair = extractPair(row.symbol);
  if (!pair) return null;

  const entryPx = num(row.avgPrice);
  if (entryPx <= 0) return null;

  const size = Math.abs(num(row.size));
  const markPx = num(row.markPrice, entryPx);

  let posSide: Position["posSide"];
  let direction: Position["direction"];

  if (row.positionIdx === 1) {
    posSide = "long";
    direction = "LONG";
  } else if (row.positionIdx === 2) {
    posSide = "short";
    direction = "SHORT";
  } else {
    // positionIdx === 0: one-way mode — use side field
    posSide = "net";
    direction =
      row.side === "Buy" ? "LONG" : row.side === "Sell" ? "SHORT" : "NEUTRAL";
  }

  const uplRatio =
    entryPx > 0
      ? ((markPx - entryPx) / entryPx) * (direction === "SHORT" ? -1 : 1)
      : 0;

  const leverage = num(row.leverage, 1);
  const notional = size * markPx;
  const liqPxRaw = num(row.liqPrice);

  const slRaw = parseFloat(row.stopLoss);
  const tpRaw = parseFloat(row.takeProfit);

  return {
    instId: row.symbol,
    pair,
    posSide,
    direction,
    size,
    entryPx,
    markPx,
    upl: num(row.unrealisedPnl),
    uplRatio,
    leverage,
    mgnMode: "cross",
    notional,
    liqPx: liqPxRaw > 0 ? liqPxRaw : null,
    slTriggerPx: isFinite(slRaw) && slRaw > 0 ? slRaw : null,
    tpTriggerPx: isFinite(tpRaw) && tpRaw > 0 ? tpRaw : null,
    cTime: parseInt(row.createdTime, 10) || Date.now(),
    source: "bybit",
  };
}

export async function fetchBybitPositions(
  clientCreds: { key: string; secret: string } | null,
): Promise<Position[] | null> {
  try {
    const res = await fetch("/api/bybit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/v5/position/list",
        method: "GET",
        params: { category: "linear", settleCoin: "USDT" },
        clientCreds,
      }),
    });
    if (!res.ok) return null;

    const proxy = (await res.json()) as BybitProxyResponse;
    if (!proxy.ok) return null;

    const data = proxy.data as { list?: BybitPositionRow[] } | null;
    if (!data || !Array.isArray(data.list)) return null;

    const positions: Position[] = [];
    for (const raw of data.list) {
      const p = parseRow(raw);
      if (p) positions.push(p);
    }
    return positions;
  } catch {
    return null;
  }
}
