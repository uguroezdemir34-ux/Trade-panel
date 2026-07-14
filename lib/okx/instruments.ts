/**
 * OKX INSTRUMENTS — SWAP kontrat meta verisi (ctVal).
 *
 * `/api/v5/public/instruments?instType=SWAP` — public endpoint, auth
 * gerekmez. Her instrument için `ctVal` (1 kontratın taban coin cinsinden
 * değeri) döner — OKX'in `/account/positions` endpoint'indeki `pos` alanı
 * KONTRAT ADEDİDİR, coin miktarı değil; gerçek coin miktarı
 * `pos × ctVal` ile hesaplanır (bkz. lib/okx/contractSize.ts).
 *
 * Bu modül saf veri katmanı: fetch + parse + Zod validate, TTL cache'i
 * (lib/okx/contractSize.ts) yönetmez — sadece "ver bana güncel ctVal
 * haritasını" isteğine cevap verir. fetchCandles ile aynı 3-şekil proxy
 * yanıt tespiti (bkz. lib/okx/candles.ts) kullanılır.
 */

import { z } from "zod";

const instrumentRowSchema = z.object({
  instId: z.string(),
  ctVal: z.string(),
  instType: z.string().optional(),
});

const instrumentsResponseSchema = z.object({
  code: z.string(),
  data: z.array(instrumentRowSchema).optional(),
});

const FETCH_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string): Promise<{ ok: boolean; json: () => Promise<unknown> }> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await globalThis.fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

/** Raw OKX/proxy yanıtı → { instId: ctVal } haritası. Hata/boş → null. */
export function parseInstrumentsResponse(raw: unknown): Record<string, number> | null {
  const r = instrumentsResponseSchema.safeParse(raw);
  if (!r.success) return null;
  if (r.data.code !== "0") return null;
  if (!r.data.data) return null;

  const map: Record<string, number> = {};
  for (const row of r.data.data) {
    const ctVal = parseFloat(row.ctVal);
    if (isFinite(ctVal) && ctVal > 0) {
      map[row.instId] = ctVal;
    }
  }
  return Object.keys(map).length > 0 ? map : null;
}

/**
 * Tüm SWAP instrument'ları çek, instId → ctVal haritasına çevir.
 * Ağ/parse hatasında null döner (caller TTL cache'e düşer / stale değeri korur).
 */
export async function fetchSwapInstruments(): Promise<Record<string, number> | null> {
  const url = "/api/okx/api/v5/public/instruments?instType=SWAP";
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const raw = await res.json();
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;

    // ── Yanıt formatı tespiti (fetchCandles ile aynı 3 olası şekil) ──
    if (typeof r.ok === "boolean") {
      if (!r.ok) return null;
      const inner = r.data;
      if (Array.isArray(inner)) {
        return parseInstrumentsResponse({ code: "0", data: inner });
      }
      if (inner && typeof inner === "object") {
        return parseInstrumentsResponse(inner);
      }
      return null;
    }

    if (typeof r.code === "string") {
      return parseInstrumentsResponse(raw);
    }

    return null;
  } catch {
    return null;
  }
}
