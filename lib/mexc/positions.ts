import type { Position } from "@/lib/okx/positions";
import type { Pair } from "@/lib/constants/pairs";
import { PAIRS } from "@/lib/constants/pairs";

interface MexcPositionRow {
  /** "BTC_USDT" (Gate.io ile aynı alt çizgili stil) */
  symbol: string;
  /** 1 = LONG, 2 = SHORT */
  positionType: number;
  /** 1 = isolated, 2 = cross (MEXC konvansiyonu — bu turda pixel-perfect doğrulanmadı, iyi bilinen genel kural) */
  openType: number;
  /** Kontrat cinsinden hacim (coin cinsi DEĞİL) */
  holdVol: number | string;
  holdAvgPrice: number | string;
  liquidatePrice: number | string;
  leverage: number | string;
  /** Haziran 2026'da eklendi (bkz. MEXC changelog) */
  unRealizedPnl?: number | string;
  createTime: number | string;
}

interface MexcProxyResponse {
  ok: boolean;
  data?: unknown;
  code?: number;
  message?: string;
}

function extractPair(symbol: string): Pair | null {
  const base = symbol.split("_")[0];
  if ((PAIRS as readonly string[]).includes(base)) return base as Pair;
  return null;
}

function num(s: string | number | undefined, fallback = 0): number {
  if (s === undefined) return fallback;
  const n = typeof s === "number" ? s : parseFloat(s);
  return isFinite(n) ? n : fallback;
}

/**
 * CONTRACT SIZE (multiplier) ÖNBELLEĞİ — "Yol B": her poll'da yeniden
 * çekmek yerine (statik bir değer, sık değişmez) 1 saatlik TTL ile
 * modül-seviyesi bellekte tutuluyor. Sayfa yenilenince sıfırlanır — bu
 * kabul edilebilir, ilk poll'da tek seferlik ekstra bir istek maliyeti.
 */
const CONTRACT_SIZE_CACHE_MS = 60 * 60 * 1000;
const contractSizeCache = new Map<string, { size: number; fetchedAt: number }>();

async function getContractSize(symbol: string): Promise<number | null> {
  const cached = contractSizeCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < CONTRACT_SIZE_CACHE_MS) {
    return cached.size;
  }
  try {
    const res = await fetch("/api/mexc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/api/v1/contract/detail",
        params: { symbol },
      }),
    });
    if (!res.ok) return cached?.size ?? null;

    const proxy = (await res.json()) as MexcProxyResponse;
    if (!proxy.ok) return cached?.size ?? null;

    const data = proxy.data as { contractSize?: number | string } | null;
    const size = num(data?.contractSize, 0);
    if (size <= 0) return cached?.size ?? null;

    contractSizeCache.set(symbol, { size, fetchedAt: Date.now() });
    return size;
  } catch {
    return cached?.size ?? null;
  }
}

/**
 * KRİTİK NOT — markPrice: MEXC'in /open_positions yanıtı doğrudan bir
 * markPrice alanı DÖNDÜRMÜYOR (bu turda dokümantasyonda bulunamadı — Gate.io/
 * KuCoin'in aksine). Bunun yerine yanıtta zaten bulunan `unRealizedPnl`
 * (gerçek API alanı) ve coin-cinsi size'dan TERSİNE türetiliyor:
 *   unrealizedPnl = (markPrice - entryPrice) × size × (LONG ? 1 : -1)
 *   => markPrice = entryPrice + (unrealizedPnl / size) × (LONG ? 1 : -1)
 * Bu bir tahmin değil, MEXC'in kendi PnL hesabının cebirsel tersi — ama
 * gerçek bir hesapla (round-trip) doğrulanmadı.
 */
async function parseRow(row: MexcPositionRow): Promise<Position | null> {
  const holdVol = num(row.holdVol);
  if (!holdVol) return null;

  const pair = extractPair(row.symbol);
  if (!pair) return null;

  const entryPx = num(row.holdAvgPrice);
  if (entryPx <= 0) return null;

  const contractSize = await getContractSize(row.symbol);
  if (!contractSize) return null; // multiplier bilinmeden coin-cinsi size hesaplanamaz

  const direction: Position["direction"] =
    row.positionType === 1 ? "LONG" : row.positionType === 2 ? "SHORT" : "NEUTRAL";
  if (direction === "NEUTRAL") return null;
  const posSide: Position["posSide"] = direction === "LONG" ? "long" : "short";

  // Gerçek coin-cinsi büyüklük — contract/detail'den çekilen gerçek multiplier ile.
  const size = holdVol * contractSize;

  const unrealizedPnl = num(row.unRealizedPnl);
  const sign = direction === "SHORT" ? -1 : 1;
  const markPx = size > 0 ? entryPx + (unrealizedPnl / size) * sign : entryPx;

  const uplRatio =
    entryPx > 0 ? ((markPx - entryPx) / entryPx) * (direction === "SHORT" ? -1 : 1) : 0;

  const liqPxRaw = num(row.liquidatePrice);

  return {
    instId: row.symbol,
    pair,
    posSide,
    direction,
    size,
    entryPx,
    markPx,
    upl: unrealizedPnl,
    uplRatio,
    leverage: num(row.leverage, 1),
    mgnMode: row.openType === 1 ? "isolated" : "cross",
    notional: size * markPx,
    liqPx: liqPxRaw > 0 ? liqPxRaw : null,
    // MEXC pozisyon listesi SL/TP trigger fiyatı döndürmüyor.
    slTriggerPx: null,
    tpTriggerPx: null,
    cTime: num(row.createTime, Date.now()),
    source: "mexc",
  };
}

export async function fetchMexcPositions(
  clientCreds: { key: string; secret: string } | null,
): Promise<Position[] | null> {
  try {
    const res = await fetch("/api/mexc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/api/v1/private/position/open_positions",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return null;

    const proxy = (await res.json()) as MexcProxyResponse;
    if (!proxy.ok) return null;

    const rows = proxy.data as MexcPositionRow[] | null;
    if (!Array.isArray(rows)) return null;

    const parsed = await Promise.all(rows.map((raw) => parseRow(raw)));
    return parsed.filter((p): p is Position => p !== null);
  } catch {
    return null;
  }
}
