/**
 * FUNDING RATE FETCH — OKX public endpoint.
 *
 * URL: /api/v5/public/funding-rate?instId=BTC-USDT-SWAP
 *
 * Response: { code: "0", data: [{ fundingRate: "0.00012345", ... }] }
 *
 * fundingRate decimal — 0.0001 = 0.01% per 8h
 */

import type { Pair } from "@/lib/constants/pairs";
import { pairToInstId } from "@/lib/exchange/okx/symbol-format";

export interface FundingRateResult {
  pair: Pair;
  /** Decimal: 0.0001 = 0.01% (per 8h funding interval) */
  fundingRate: number;
  /** Annualized: rate * 3 * 365 (3 funding/day) */
  annualizedPct: number;
  /** Bir sonraki funding zamanı (epoch ms, varsa) */
  nextFundingTime?: number;
  /** Veri kaynağı */
  source: "api" | "fallback";
}

/**
 * Tek pair için funding fetch.
 * Hata olursa rate=0 ile fallback döner.
 */
export async function fetchFundingRate(
  pair: Pair,
  fetchFn: typeof fetch = fetch,
): Promise<FundingRateResult> {
  const instId = pairToInstId(pair);
  const url = `/api/okx/api/v5/public/funding-rate?instId=${encodeURIComponent(instId)}`;

  try {
    const res = await fetchFn(url);
    if (!res.ok) {
      return {
        pair,
        fundingRate: 0,
        annualizedPct: 0,
        source: "fallback",
      };
    }

    const raw = (await res.json()) as Record<string, unknown>;

    // Proxy zarfı: { ok: true, data: [...] } | Direkt OKX: { code, data: [...] }
    let items: unknown;
    if (typeof raw.ok === "boolean") {
      if (!raw.ok) return { pair, fundingRate: 0, annualizedPct: 0, source: "fallback" };
      items = raw.data;
    } else if (raw.code === "0") {
      items = raw.data;
    } else {
      return { pair, fundingRate: 0, annualizedPct: 0, source: "fallback" };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { pair, fundingRate: 0, annualizedPct: 0, source: "fallback" };
    }

    const first = items[0] as Record<string, unknown>;
    const rateStr = first.fundingRate as string | undefined;
    const rate = rateStr ? parseFloat(rateStr) : 0;
    if (!isFinite(rate)) {
      return {
        pair,
        fundingRate: 0,
        annualizedPct: 0,
        source: "fallback",
      };
    }

    let nextFundingTime: number | undefined;
    const nextStr = first.fundingTime as string | undefined;
    if (nextStr) {
      const n = parseInt(nextStr, 10);
      if (isFinite(n)) nextFundingTime = n;
    }

    // Annualized: 3 funding/gün × 365 gün
    const annualizedPct = rate * 3 * 365 * 100;

    return {
      pair,
      fundingRate: rate,
      annualizedPct,
      nextFundingTime,
      source: "api",
    };
  } catch {
    return {
      pair,
      fundingRate: 0,
      annualizedPct: 0,
      source: "fallback",
    };
  }
}

/**
 * Funding rate yorumu (UI rengi için).
 *  - extreme_long: >= 0.01% (longlar pahalı)
 *  - elevated_long: 0.005-0.01%
 *  - neutral: -0.005 to +0.005%
 *  - elevated_short: -0.005 to -0.01%
 *  - extreme_short: <= -0.01%
 */
export type FundingTier =
  | "extreme_long"
  | "elevated_long"
  | "neutral"
  | "elevated_short"
  | "extreme_short";

export function classifyFundingRate(rate: number): FundingTier {
  if (rate >= 0.0001) return "extreme_long";
  if (rate >= 0.00005) return "elevated_long";
  if (rate <= -0.0001) return "extreme_short";
  if (rate <= -0.00005) return "elevated_short";
  return "neutral";
}
