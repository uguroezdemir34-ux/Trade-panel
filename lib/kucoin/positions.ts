import type { Position } from "@/lib/okx/positions";
import type { Pair } from "@/lib/constants/pairs";
import { PAIRS } from "@/lib/constants/pairs";

interface KucoinPositionRow {
  /** "XBTUSDTM", "ETHUSDTM", ... */
  symbol: string;
  /** İşaretli, KONTRAT cinsinden (+long/-short), 0 = pozisyon yok */
  currentQty: number | string;
  avgEntryPrice: number | string;
  markPrice: number | string;
  /** Notional (settlement currency = USDT) — coin-cinsi büyüklüğü türetmek için */
  markValue: number | string;
  unrealisedPnl: number | string;
  liquidationPrice: number | string;
  realLeverage: number | string;
  crossMode: boolean;
  openingTimestamp: number | string;
}

interface KucoinProxyResponse {
  ok: boolean;
  data?: unknown;
  code?: string;
  msg?: string;
}

/**
 * KuCoin sembol → dahili Pair. BTC istisnai olarak "XBT" önekiyle temsil
 * ediliyor (ISO 4217 kripto konvansiyonu, Kraken'de de aynı) — doğrulandı
 * (XBTUSDTM = BTC-USDT perpetual). Diğer pariteler standart ticker +
 * "USDTM" son ekini kullanıyor (ETHUSDTM doğrulandı) — ama SOL/BNB/LINK/
 * SUI/AVAX/NEAR/XRP'nin her biri tek tek gerçek bir hesapla test edilmedi,
 * sadece desen tutarlılığına güvenildi.
 */
const TICKER_OVERRIDES: Record<string, string> = { XBT: "BTC" };

function extractPair(symbol: string): Pair | null {
  const base = symbol.endsWith("USDTM") ? symbol.slice(0, -5) : symbol;
  const mapped = TICKER_OVERRIDES[base] ?? base;
  if ((PAIRS as readonly string[]).includes(mapped)) return mapped as Pair;
  return null;
}

function num(s: string | number | undefined, fallback = 0): number {
  if (s === undefined) return fallback;
  const n = typeof s === "number" ? s : parseFloat(s);
  return isFinite(n) ? n : fallback;
}

/**
 * KuCoin futures `currentQty` de (Gate.io'daki gibi) KONTRAT cinsindendir,
 * coin cinsi değil (örn. XBTUSDTM = kontrat başına 0.001 BTC — multiplier
 * pariteye göre değişir). Aynı Gate.io çözümü uygulanıyor: `markValue`
 * (USDT notional) / `markPrice` ile coin-cinsi büyüklük TÜRETİLİYOR —
 * multiplier bilinmeden de doğru sonuç verir.
 *
 * NOT: KuCoin Futures'ın Bybit/Gate.io'daki gibi ayrı bir hedge/dual-mode
 * pozisyon şeması olduğuna dair dokümantasyonda kanıt bulunamadı — tek
 * işaretli `currentQty` alanıyla net pozisyon modeli gibi görünüyor, ama bu
 * gerçek bir hesapla doğrulanmadı (bu sandbox'ta KuCoin'e canlı erişim yok).
 */
function parseRow(row: KucoinPositionRow): Position | null {
  const qty = num(row.currentQty);
  if (!qty) return null;

  const pair = extractPair(row.symbol);
  if (!pair) return null;

  const entryPx = num(row.avgEntryPrice);
  if (entryPx <= 0) return null;

  const markPx = num(row.markPrice, entryPx);
  const notional = Math.abs(num(row.markValue));
  const size = markPx > 0 ? notional / markPx : 0;

  const direction: Position["direction"] = qty > 0 ? "LONG" : "SHORT";
  const posSide: Position["posSide"] = direction === "LONG" ? "long" : "short";

  const uplRatio =
    entryPx > 0 ? ((markPx - entryPx) / entryPx) * (direction === "SHORT" ? -1 : 1) : 0;

  const liqPxRaw = num(row.liquidationPrice);

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
    leverage: num(row.realLeverage, 1),
    mgnMode: row.crossMode ? "cross" : "isolated",
    notional,
    liqPx: liqPxRaw > 0 ? liqPxRaw : null,
    // KuCoin pozisyon listesi SL/TP trigger fiyatı döndürmüyor.
    slTriggerPx: null,
    tpTriggerPx: null,
    cTime: num(row.openingTimestamp, Date.now()),
    source: "kucoin",
  };
}

export async function fetchKucoinPositions(
  clientCreds: { key: string; secret: string; passphrase: string } | null,
): Promise<Position[] | null> {
  try {
    const res = await fetch("/api/kucoin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/api/v1/positions",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return null;

    const proxy = (await res.json()) as KucoinProxyResponse;
    if (!proxy.ok) return null;

    const rows = proxy.data as KucoinPositionRow[] | null;
    if (!Array.isArray(rows)) return null;

    const positions: Position[] = [];
    for (const raw of rows) {
      const p = parseRow(raw);
      if (p) positions.push(p);
    }
    return positions;
  } catch {
    return null;
  }
}
