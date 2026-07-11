/**
 * /api/macro/marketcap — CoinGecko market cap proxy.
 *
 * 20 pair için USD market cap'i çeker. 5dk sunucu-tarafı cache.
 * Browser → bu route → CoinGecko (CORS sorunsuz, tek yerden kontrol).
 */

import { NextResponse } from "next/server";

const COINGECKO_IDS: Record<string, string> = {
  BTC:    "bitcoin",
  ETH:    "ethereum",
  XRP:    "ripple",
  SOL:    "solana",
  BNB:    "binancecoin",
  ADA:    "cardano",
  AVAX:   "avalanche-2",
  LINK:   "chainlink",
  DOGE:   "dogecoin",
  SHIB:   "shiba-inu",
  SUI:    "sui",
  NEAR:   "near",
  APT:    "aptos",
  TAO:    "bittensor",
  PENDLE: "pendle",
  OP:     "optimism",
  WIF:    "dogwifcoin",
};

const ID_TO_PAIR: Record<string, string> = Object.fromEntries(
  Object.entries(COINGECKO_IDS).map(([pair, id]) => [id, pair]),
);

const CG_URL =
  `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd` +
  `&ids=${Object.values(COINGECKO_IDS).join(",")}&per_page=50&sparkline=false`;

const CACHE_TTL_MS = 5 * 60_000;

let _cache: { data: Record<string, number>; at: number } | null = null;

interface CoinMarket {
  id: string;
  market_cap: number | null;
}

export async function GET() {
  const now = Date.now();

  if (_cache && now - _cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ marketCap: _cache.data, fetchedAt: _cache.at });
  }

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8_000);
    const res = await fetch(CG_URL, { signal: ctrl.signal });
    clearTimeout(tid);

    if (!res.ok) {
      return NextResponse.json({ marketCap: {}, fetchedAt: now });
    }

    const raw = (await res.json()) as CoinMarket[];
    const marketCap: Record<string, number> = {};

    for (const coin of raw) {
      const pair = ID_TO_PAIR[coin.id];
      if (pair && typeof coin.market_cap === "number" && coin.market_cap > 0) {
        marketCap[pair] = coin.market_cap;
      }
    }

    _cache = { data: marketCap, at: now };
    return NextResponse.json({ marketCap, fetchedAt: now });
  } catch {
    return NextResponse.json({ marketCap: {}, fetchedAt: now });
  }
}
