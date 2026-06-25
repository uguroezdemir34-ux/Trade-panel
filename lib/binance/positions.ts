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

interface BinanceOrderRow {
  symbol: string;
  type: string;
  side: string;
  positionSide: string;
  stopPrice: string;
  origType: string;
}

interface BinanceProxyResponse {
  ok: boolean;
  data: unknown;
  code?: number;
  msg?: string;
}

// symbol_positionSide (hedge: "BTCUSDT_LONG") veya symbol_direction (one-way: "BTCUSDT_LONG")
type AlgoKey = string;
type AlgoMap = Record<AlgoKey, { sl: number | null; tp: number | null }>;

/**
 * Açık algo emirlerinden SL/TP haritası çıkarır.
 * Binance positionRisk SL/TP döndürmez — openOrders'tan derive edilir.
 *
 * Hedge mode: positionSide=LONG/SHORT → direkt eşleşme
 * One-way mode: positionSide=BOTH, side=SELL → long SL/TP; side=BUY → short SL/TP
 */
async function fetchBinanceAlgoMap(
  clientCreds: { key: string; secret: string } | null,
): Promise<AlgoMap> {
  const map: AlgoMap = {};
  try {
    const res = await fetch("/api/binance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/fapi/v1/openOrders",
        method: "GET",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return map;

    const proxy = (await res.json()) as BinanceProxyResponse;
    if (!proxy.ok || !Array.isArray(proxy.data)) return map;

    for (const row of proxy.data as BinanceOrderRow[]) {
      const px = parseFloat(row.stopPrice);
      if (!isFinite(px) || px <= 0) continue;

      const type = row.origType ?? row.type;
      const isStop = type === "STOP_MARKET" || type === "STOP";
      const isTp = type === "TAKE_PROFIT_MARKET" || type === "TAKE_PROFIT";
      if (!isStop && !isTp) continue;

      // Resolve which direction this order covers
      let direction: "LONG" | "SHORT";
      if (row.positionSide === "LONG") {
        direction = "LONG";
      } else if (row.positionSide === "SHORT") {
        direction = "SHORT";
      } else {
        // One-way (BOTH): SELL order → protecting long, BUY order → protecting short
        direction = row.side === "SELL" ? "LONG" : "SHORT";
      }

      const key: AlgoKey = `${row.symbol}_${direction}`;
      const entry = map[key] ?? { sl: null, tp: null };
      if (isStop && !entry.sl) entry.sl = px;
      if (isTp && !entry.tp) entry.tp = px;
      map[key] = entry;
    }
  } catch {
    // Non-fatal — positions will show without SL/TP lines
  }
  return map;
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
    source: "binance",
  };
}

export async function fetchBinancePositions(
  clientCreds: { key: string; secret: string } | null,
): Promise<Position[] | null> {
  try {
    const [posRes, algoMap] = await Promise.all([
      fetch("/api/binance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/fapi/v2/positionRisk",
          method: "GET",
          params: {},
          clientCreds,
        }),
      }),
      fetchBinanceAlgoMap(clientCreds),
    ]);

    if (!posRes.ok) return null;
    const proxy = (await posRes.json()) as BinanceProxyResponse;
    if (!proxy.ok) return null;
    if (!Array.isArray(proxy.data)) return null;

    const positions: Position[] = [];
    for (const raw of proxy.data as BinancePositionRow[]) {
      const p = parseRow(raw);
      if (!p) continue;
      // Merge SL/TP from algo orders
      const key: AlgoKey = `${raw.symbol}_${p.direction}`;
      const algo = algoMap[key];
      if (algo) {
        p.slTriggerPx = algo.sl;
        p.tpTriggerPx = algo.tp;
      }
      positions.push(p);
    }
    return positions;
  } catch {
    return null;
  }
}
