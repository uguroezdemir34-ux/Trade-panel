"use client";

/**
 * ORDER BOOK POLLER — OKX REST /api/v5/market/books endpoint'ini 500ms'de polling yapar.
 *
 * WS yerine REST tercih edildi: mevcut WS client'a yeni kanal eklemek yerine
 * bağımsız REST döngüsü daha güvenli (mevcut WS mantığını bozmaz).
 * 500ms polling DOM görselleştirmesi için yeterli (insan algısı ~200ms+).
 */

import { useEffect } from "react";
import type { Pair } from "@/lib/constants/pairs";
import {
  parseOkxOrderBook,
  type OkxOrderBookRaw,
} from "@/lib/orderflow/orderbook";
import { useOrderbookStore } from "@/lib/store/orderbookStore";

const POLL_MS = 500;
const LEVELS  = 20;

function extractRaw(json: unknown): OkxOrderBookRaw | null {
  const r = json as Record<string, unknown>;

  // Case 1: proxy wrapper {ok: true, data: [...]}
  if (r.ok === true) {
    const inner = r.data;
    if (Array.isArray(inner) && inner.length > 0) {
      return inner[0] as OkxOrderBookRaw;
    }
    // Case 2: {ok: true, data: {code, data: [...]}}
    if (inner && typeof inner === "object") {
      const nested = (inner as Record<string, unknown>).data;
      if (Array.isArray(nested) && nested.length > 0) {
        return nested[0] as OkxOrderBookRaw;
      }
    }
    return null;
  }

  // Case 3: direct OKX {code: "0", data: [...]}
  if (r.code === "0" && Array.isArray(r.data) && r.data.length > 0) {
    return r.data[0] as OkxOrderBookRaw;
  }

  return null;
}

export function useOrderbookPoller(pair: Pair): void {
  const updateSnapshot = useOrderbookStore((s) => s.updateSnapshot);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const instId = `${pair}-USDT-SWAP`;
    const url = `/api/okx/api/v5/market/books?instId=${encodeURIComponent(instId)}&sz=${LEVELS}`;

    async function poll(): Promise<void> {
      if (!active) return;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(3_000),
          cache: "no-store",
        });
        if (!res.ok || !active) return;
        const json = await res.json();
        const raw = extractRaw(json);
        if (raw && active) {
          const snap = parseOkxOrderBook(raw, pair);
          if (snap.bids.length > 0 || snap.asks.length > 0) {
            updateSnapshot(pair, snap);
          }
        }
      } catch { /* network — silent */ }

      if (active) timer = setTimeout(() => { void poll(); }, POLL_MS);
    }

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [pair, updateSnapshot]);
}
