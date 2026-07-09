/**
 * OKX ORDER BOOK — Emir defteri derinliği çekme (top-5).
 *
 * `/api/v5/market/books` endpoint'i (PUBLIC — API key gerekmez, candles/ticker
 * ile aynı erişim sınıfı):
 *   - instId: "BTC-USDT-SWAP"
 *   - sz: "5" (top-5 seviye, hafif payload — tam derinlik/checksum karmaşıklığı yok)
 *
 * Response format (data[0].asks / data[0].bids, her satır string array):
 *   [price, size, deprecatedLiqCount, orderCount]
 *
 * Bu modül saf veri katmanı: fetch + parse + Zod validate — fetchCandles ile
 * birebir aynı desen. Caller (useOrderBookPoller) polling yönetir.
 */

import { z } from "zod";
import type { Pair } from "@/lib/constants/pairs";

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  pair: Pair;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  ts: number;
}

function instIdFor(pair: Pair): string {
  return `${pair}-USDT-SWAP`;
}

const okxBookLevelSchema = z.array(z.string()).min(2);
const okxBookSchema = z.object({
  code: z.string(),
  data: z.array(
    z.object({
      asks: z.array(okxBookLevelSchema),
      bids: z.array(okxBookLevelSchema),
      ts: z.string(),
    }),
  ),
});

function parseLevel(row: string[]): OrderBookLevel | null {
  const price = parseFloat(row[0]);
  const size = parseFloat(row[1]);
  if (!isFinite(price) || !isFinite(size) || price <= 0 || size <= 0) return null;
  return { price, size };
}

export function parseOrderBookResponse(pair: Pair, raw: unknown): OrderBookSnapshot | null {
  const r = okxBookSchema.safeParse(raw);
  if (!r.success) return null;
  if (r.data.code !== "0") return null;
  const row = r.data.data[0];
  if (!row) return null;

  const bids = row.bids.map(parseLevel).filter((l): l is OrderBookLevel => l !== null);
  const asks = row.asks.map(parseLevel).filter((l): l is OrderBookLevel => l !== null);
  if (bids.length === 0 || asks.length === 0) return null;

  return { pair, bids, asks, ts: parseInt(row.ts, 10) || Date.now() };
}

/** HTTP fetch arayüzü (test mock'u için) — fetchCandles ile aynı desen */
export type FetchFn = (url: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/**
 * Top-5 order book çek.
 *
 * @param pair BTC | ETH | ...
 * @param sz Derinlik seviyesi (default 5 — hafif payload)
 * @param fetchFn HTTP fetch (default global)
 */
export async function fetchOrderBook(
  pair: Pair,
  sz: number = 5,
  fetchFn?: FetchFn,
): Promise<OrderBookSnapshot | null> {
  const fn = fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  const instId = instIdFor(pair);
  const url = `/api/okx/api/v5/market/books?instId=${encodeURIComponent(instId)}&sz=${sz}`;
  try {
    const res = await fn(url);
    if (!res.ok) return null;
    const raw = await res.json();
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;

    // Proxy zarfı: { ok: true, data: <OKX data array> } — fetchCandles ile aynı yorumlama
    if (typeof r.ok === "boolean") {
      if (!r.ok) return null;
      const inner = r.data;
      if (Array.isArray(inner)) {
        return parseOrderBookResponse(pair, { code: "0", data: inner });
      }
      if (inner && typeof inner === "object") {
        return parseOrderBookResponse(pair, inner);
      }
      return null;
    }

    // Direkt OKX response: { code: "0", data: [...] }
    if (typeof r.code === "string") {
      return parseOrderBookResponse(pair, raw);
    }

    return null;
  } catch {
    return null;
  }
}
