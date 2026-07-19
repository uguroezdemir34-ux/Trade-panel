import type { Position } from "@/lib/okx/positions";
import type { Pair } from "@/lib/constants/pairs";
import { PAIRS } from "@/lib/constants/pairs";

interface KrakenPositionRow {
  side: string; // "long" | "short"
  /** "PF_XBTUSD" (perpetual) — "FI_..." (vadeli/dated) hariç tutuluyor */
  symbol: string;
  /** Ortalama giriş fiyatı */
  price: number;
  fillTime: string; // ISO 8601
  size: number;
  unrealizedFunding?: number;
  pnlCurrency?: string;
  maxFixedLeverage?: number;
}

interface KrakenProxyResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

interface KrakenTickerRow {
  symbol: string;
  markPrice: number;
}

function num(s: number | string | undefined, fallback = 0): number {
  if (s === undefined) return fallback;
  const n = typeof s === "number" ? s : parseFloat(s);
  return isFinite(n) ? n : fallback;
}

/**
 * "PF_XBTUSD" → "BTC". Sadece perpetual (PF_ öneki) kabul edilir — vadeli/
 * expiry'li kontratlar (FI_ öneki) bu entegrasyonun kapsamı dışında,
 * extractPair null döner ve satır atlanır. XBT→BTC eşleştirmesi (Kraken'in
 * ISO 4217 kripto konvansiyonu, KuCoin'deki XBT ile aynı) doğrulandı.
 * Quote para birimi "USD" olarak varsayılıyor (Kraken'in perpetual ana
 * ürünü USD-marjlı, USDT değil — bkz. dosya başı yorumu).
 */
function extractPair(symbol: string): Pair | null {
  if (!symbol.startsWith("PF_")) return null;
  const rest = symbol.slice(3);
  const base = rest.endsWith("USD") ? rest.slice(0, -3) : rest;
  const mapped = base === "XBT" ? "BTC" : base;
  if ((PAIRS as readonly string[]).includes(mapped)) return mapped as Pair;
  return null;
}

/**
 * Tüm perpetual ticker'ları TEK istekte çeker (pozisyon başına ayrı istek
 * yerine — MEXC'teki contractSize önbelleğinden farklı olarak markPrice
 * sürekli değiştiği için uzun süre önbelleklenemez, ama tickers endpoint'i
 * zaten tüm sembolleri tek seferde döndürüyor, N+1 istek riski yok).
 */
async function fetchMarkPriceMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch("/api/kraken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/derivatives/api/v3/tickers", params: {} }),
    });
    if (!res.ok) return map;

    const proxy = (await res.json()) as KrakenProxyResponse;
    if (!proxy.ok) return map;

    const body = proxy.data as { tickers?: KrakenTickerRow[] } | null;
    for (const t of body?.tickers ?? []) {
      if (typeof t.markPrice === "number") map.set(t.symbol, t.markPrice);
    }
  } catch {
    /* boş map dönülür — caller entryPx'e düşer */
  }
  return map;
}

function parseRow(row: KrakenPositionRow, markPriceMap: Map<string, number>): Position | null {
  const pair = extractPair(row.symbol);
  if (!pair) return null;

  const entryPx = num(row.price);
  if (entryPx <= 0) return null;

  const direction: Position["direction"] =
    row.side === "long" ? "LONG" : row.side === "short" ? "SHORT" : "NEUTRAL";
  if (direction === "NEUTRAL") return null;
  const posSide: Position["posSide"] = direction === "LONG" ? "long" : "short";

  // ═══════════════════ KRİTİK DOĞRULANMAMIŞ VARSAYIM ═══════════════════
  // Kraken Futures'ın `size` alanının coin cinsinden mi (ör. 3.0 = 3 BTC)
  // yoksa kontrat cinsinden mi (bir multiplier gerektiren) olduğu bu
  // entegrasyon araştırmasında KESİN DOĞRULANAMADI — çelişkili sinyaller
  // bulundu: eski/inverse kontrat ailesi (PI_XBTUSD) için "contractSize: 1"
  // dokümante edilmiş, ama linear/perpetual (PF_) ailesi için bir örnekte
  // "PF_BTCUSD'de 3 BTC'lik pozisyon" ifadesi coin-cinsi olduğunu
  // düşündürüyor. Bu entegrasyon `size`'ın DOĞRUDAN COİN CİNSİNDEN
  // olduğunu VARSAYIYOR — HİÇBİR kontrat multiplier'ı UYGULANMIYOR.
  // Eğer bu varsayım yanlışsa, gösterilen pozisyon büyüklüğü gerçek
  // değerin bir katı/kesri kadar YANLIŞ olacaktır. GERÇEK BİR KRAKEN
  // HESABIYLA DOĞRULANMADAN GÜVENİLMEMELİDİR.
  const size = num(row.size);
  // ══════════════════════════════════════════════════════════════════

  // markPrice pozisyon yanıtında yok — ayrı public /tickers endpoint'inden.
  // Sembol eşleşmezse (ör. tickers isteği başarısız oldu) entryPx'e düşülür.
  const markPx = markPriceMap.get(row.symbol) ?? entryPx;

  const upl = (markPx - entryPx) * size * (direction === "SHORT" ? -1 : 1);
  const uplRatio =
    entryPx > 0 ? ((markPx - entryPx) / entryPx) * (direction === "SHORT" ? -1 : 1) : 0;

  const cTimeParsed = Date.parse(row.fillTime);

  return {
    instId: row.symbol,
    pair,
    posSide,
    direction,
    size,
    entryPx,
    markPx,
    upl,
    uplRatio,
    // Kraken pozisyon yanıtı gerçek kullanılan kaldıracı döndürmüyor
    // (maxFixedLeverage sadece kontratın İZİN VERDİĞİ tavan) — bilgi yok,
    // güvenli varsayılan 1.
    leverage: 1,
    // Pozisyon başına margin modu (cross/isolated) yanıtta yok — Kraken'in
    // varsayılan/genel davranışına göre "cross" varsayılıyor.
    mgnMode: "cross",
    notional: size * markPx,
    // Likidasyon fiyatı pozisyon yanıtında yok.
    liqPx: null,
    slTriggerPx: null,
    tpTriggerPx: null,
    cTime: isFinite(cTimeParsed) ? cTimeParsed : Date.now(),
    source: "kraken",
  };
}

export async function fetchKrakenPositions(
  clientCreds: { key: string; secret: string } | null,
): Promise<Position[] | null> {
  try {
    const res = await fetch("/api/kraken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "/derivatives/api/v3/openpositions",
        params: {},
        clientCreds,
      }),
    });
    if (!res.ok) return null;

    const proxy = (await res.json()) as KrakenProxyResponse;
    if (!proxy.ok) return null;

    const body = proxy.data as { openPositions?: KrakenPositionRow[] } | null;
    const rows = body?.openPositions;
    if (!Array.isArray(rows)) return null;
    if (rows.length === 0) return [];

    const markPriceMap = await fetchMarkPriceMap();

    const positions: Position[] = [];
    for (const raw of rows) {
      const p = parseRow(raw, markPriceMap);
      if (p) positions.push(p);
    }
    return positions;
  } catch {
    return null;
  }
}
