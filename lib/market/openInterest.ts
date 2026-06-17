/**
 * OPEN INTEREST FETCH — OKX public endpoint.
 *
 * URL: /api/v5/public/open-interest?instType=SWAP&instId=BTC-USDT-SWAP
 *
 * Response: { code: "0", data: [{ instId, instType, oi, oiCcy, ts }] }
 *   - oi    → açık kontrat sayısı (contract count)
 *   - oiCcy → coin cinsinden açık ilgi (örn BTC adedi)
 *   - ts    → timestamp (epoch ms)
 *
 * ───────────────────── MÜHENDİSLİK NOTU ─────────────────────
 * Open Interest TEK BAŞINA anlamsızdır. Asıl değeri fiyat hareketiyle
 * KOMBİNASYONUNDA ortaya çıkar:
 *
 *   Fiyat ↑ + OI ↑  → SAĞLAM yükseliş (yeni para/pozisyon giriyor)
 *   Fiyat ↑ + OI ↓  → ZAYIF yükseliş (short kapanışı / short squeeze)
 *   Fiyat ↓ + OI ↑  → SAĞLAM düşüş (yeni short pozisyonlar açılıyor)
 *   Fiyat ↓ + OI ↓  → ZAYIF düşüş (long kapanışı / long likidasyonu)
 *
 * Bu yüzden modül hem anlık OI'yi hem de fiyat-OI birleşik yorumunu sağlar.
 * Funding rate modülüyle (lib/market/fundingRate.ts) birebir aynı mimari:
 * proxy unwrap, fallback, dependency-injected fetch.
 */

import type { Pair } from "@/lib/constants/pairs";
import { pairToInstId } from "@/lib/exchange/okx/symbol-format";
import { parseProxyItems } from "@/lib/market/parseProxyItems";

export interface OpenInterestResult {
  pair: Pair;
  /** Açık kontrat sayısı (contract count) */
  oi: number;
  /** Coin cinsinden açık ilgi (örn BTC adedi) */
  oiCcy: number;
  /** Veri zamanı (epoch ms, varsa) */
  ts?: number;
  /** Veri kaynağı */
  source: "api" | "fallback";
}

/**
 * Tek pair için open interest fetch.
 * Hata olursa oi=0 ile fallback döner (funding pattern ile aynı).
 */
export async function fetchOpenInterest(
  pair: Pair,
  fetchFn: typeof fetch = fetch,
): Promise<OpenInterestResult> {
  const instId = pairToInstId(pair);
  const url = `/api/okx/api/v5/public/open-interest?instType=SWAP&instId=${encodeURIComponent(instId)}`;

  const fallback: OpenInterestResult = {
    pair,
    oi: 0,
    oiCcy: 0,
    source: "fallback",
  };

  try {
    const res = await fetchFn(url);
    if (!res.ok) return fallback;

    const raw = (await res.json()) as Record<string, unknown>;

    const items = parseProxyItems(raw);
    if (!items) return fallback;

    const first = items[0];
    const oiStr = first.oi as string | undefined;
    const oiCcyStr = first.oiCcy as string | undefined;

    const oi = oiStr ? parseFloat(oiStr) : NaN;
    const oiCcy = oiCcyStr ? parseFloat(oiCcyStr) : NaN;

    // En az biri geçerli olmalı
    if (!isFinite(oi) && !isFinite(oiCcy)) return fallback;

    let ts: number | undefined;
    const tsStr = first.ts as string | undefined;
    if (tsStr) {
      const n = parseInt(tsStr, 10);
      if (isFinite(n)) ts = n;
    }

    return {
      pair,
      oi: isFinite(oi) ? oi : 0,
      oiCcy: isFinite(oiCcy) ? oiCcy : 0,
      ts,
      source: "api",
    };
  } catch {
    return fallback;
  }
}

/**
 * Fiyat + OI birleşik yorumu — OI'nin ASIL değeri burada.
 *
 * @param priceChangePct - Fiyat değişim yüzdesi (örn +1.5 = %1.5 artış)
 * @param oiChangePct - OI değişim yüzdesi (önceki ölçüme göre)
 * @returns Piyasa yapısı yorumu
 */
export type OiPriceSignal =
  | "strong_up" // Fiyat↑ + OI↑ → sağlam yükseliş
  | "weak_up" // Fiyat↑ + OI↓ → short squeeze / zayıf
  | "strong_down" // Fiyat↓ + OI↑ → sağlam düşüş
  | "weak_down" // Fiyat↓ + OI↓ → long kapanışı / zayıf
  | "neutral"; // Anlamlı hareket yok

/** Fiyat ve OI değişimini "anlamlı" sayma eşiği (gürültü filtresi) */
const PRICE_THRESHOLD_PCT = 0.1; // %0.1
const OI_THRESHOLD_PCT = 0.2; // %0.2

export function interpretOiPriceAction(
  priceChangePct: number,
  oiChangePct: number,
): OiPriceSignal {
  const priceUp = priceChangePct > PRICE_THRESHOLD_PCT;
  const priceDown = priceChangePct < -PRICE_THRESHOLD_PCT;
  const oiUp = oiChangePct > OI_THRESHOLD_PCT;
  const oiDown = oiChangePct < -OI_THRESHOLD_PCT;

  if (priceUp && oiUp) return "strong_up";
  if (priceUp && oiDown) return "weak_up";
  if (priceDown && oiUp) return "strong_down";
  if (priceDown && oiDown) return "weak_down";
  return "neutral";
}

/**
 * OI sinyalinin insan-okur açıklaması (UI için).
 */
export function describeOiSignal(signal: OiPriceSignal): {
  label: string;
  tone: "bull" | "bear" | "neutral";
} {
  switch (signal) {
    case "strong_up":
      return { label: "Strong rise (new longs)", tone: "bull" };
    case "weak_up":
      return { label: "Weak rise (short squeeze)", tone: "neutral" };
    case "strong_down":
      return { label: "Strong drop (new shorts)", tone: "bear" };
    case "weak_down":
      return { label: "Weak drop (long unwind)", tone: "neutral" };
    case "neutral":
      return { label: "No clear flow", tone: "neutral" };
  }
}
