import type { Position } from "@/lib/okx/positions";
import type { Pair } from "@/lib/constants/pairs";
import { PAIRS } from "@/lib/constants/pairs";

interface BinancePositionRow {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  positionSide: string;
  updateTime: number;
}

interface BinanceProxyResponse {
  ok: boolean;
  data: unknown;
  code?: number;
  msg?: string;
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

function parseRow(row: BinancePositionRow): Position | null {
  const amt = parseFloat(row.positionAmt);
  if (!isFinite(amt) || amt === 0) return null;

  const pair = extractPair(row.symbol);
  if (!pair) return null;

  const entryPx = num(row.entryPrice);
  if (entryPx <= 0) return null;

  const markPx = num(row.markPrice, entryPx);
  const size = Math.abs(amt);

  let posSide: Position["posSide"];
  let direction: Position["direction"];

  if (row.positionSide === "LONG") {
    posSide = "long";
    direction = "LONG";
  } else if (row.positionSide === "SHORT") {
    posSide = "short";
    direction = "SHORT";
  } else {
    // "BOTH" = one-way/net mode
    posSide = "net";
    direction = amt > 0 ? "LONG" : amt < 0 ? "SHORT" : "NEUTRAL";
  }

  const uplRatio =
    entryPx > 0
      ? ((markPx - entryPx) / entryPx) * (direction === "SHORT" ? -1 : 1)
      : 0;

  const leverage = num(row.leverage, 1);
  const notional = size * markPx;
  const liqPxRaw = num(row.liquidationPrice);

  const mgnRaw = row.marginType?.toLowerCase();
  const mgnMode: Position["mgnMode"] =
    mgnRaw === "isolated" ? "isolated" : "cross";

  return {
    instId: row.symbol,
    pair,
    posSide,
    direction,
    size,
    entryPx,
    markPx,
    upl: num(row.unRealizedProfit),
    uplRatio,
    leverage,
    mgnMode,
    notional,
    liqPx: liqPxRaw > 0 ? liqPxRaw : null,
    slTriggerPx: null,
    tpTriggerPx: null,
    cTime: row.updateTime || Date.now(),
  };
}

export async function fetchBinancePositions(
  clientCreds: { key: string; secret: string } | null,
): Promise<Position[] | null> {
  try {
    const res = await fetch("/api/binance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/fapi/v2/positionRisk",
        method: "GET",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return null;

    const proxy = (await res.json()) as BinanceProxyResponse;
    if (!proxy.ok) return null;

    if (!Array.isArray(proxy.data)) return null;

    const positions: Position[] = [];
    for (const raw of proxy.data as BinancePositionRow[]) {
      const p = parseRow(raw);
      if (p) positions.push(p);
    }
    return positions;
  } catch {
    return null;
  }
}
