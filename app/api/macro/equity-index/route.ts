/**
 * /api/macro/equity-index — Finnhub quote proxy (SPY/QQQ/UUP/DIA → S&P500/Nasdaq/DXY/Dow proxy).
 *
 * equityIndexStore üzerinden hem skor motoruna (composeScoreInput →
 * ScoreInput.sp500ChangePct/nasdaqChangePct/dxyChangePct/dowChangePct) hem
 * TickerTape.tsx'e (SPY/QQQ/UUP/DIA → "S&P 500"/"NASDAQ"/"DXY"/"DOW" satırları)
 * bağlı. Aynı FINNHUB_API_KEY'i kullanır (app/api/news/route.ts ile
 * paylaşılan) ama sadece sunucu tarafında okunur — client'a hiç sızmaz
 * (aksi halde token tarayıcı network tab'ında görünür olurdu).
 *
 * Key yoksa `available: false` döner, throw etmez — useEquityIndexPoller
 * bunu sessizce "devre dışı" olarak yorumlar (bkz. o dosyanın header'ı).
 *
 * SPY/QQQ/UUP/DIA sırayla (paralel değil) çekilir — Finnhub free tier rate
 * limitine (~60 çağrı/dk) karşı gereksiz burst yaratmamak için. Her sembol
 * kendi try/catch'i içinde izole — biri başarısız olursa diğerlerini
 * etkilemez, o sembol için null döner.
 *
 * 4dk sunucu-tarafı cache — useEquityIndexPoller 5dk'da bir çağırır, TTL o
 * pencerenin altında kalır (news route'la aynı desen).
 */

import { NextResponse } from "next/server";

const SYMBOLS = ["SPY", "QQQ", "UUP", "DIA"] as const;
type IndexSymbol = (typeof SYMBOLS)[number];

const CACHE_TTL_MS = 4 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

interface IndexQuote {
  price: number;
  changePct: number | null;
}

type IndicesMap = Record<IndexSymbol, IndexQuote | null>;

let _cache: { indices: IndicesMap; at: number } | null = null;

async function fetchQuote(symbol: IndexSymbol, apiKey: string): Promise<IndexQuote | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`,
      { signal: ctrl.signal },
    );
    clearTimeout(tid);
    if (!res.ok) return null;

    const raw = (await res.json()) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;

    // Savunmacı parse: c (current price) ve dp (percent change) alanlarını
    // varsayar, ama tip/varlık garantisi yok — Finnhub sembolü bulamazsa
    // tüm alanlar 0 dönebilir, bu yüzden price <= 0 da geçersiz sayılır.
    const price = r.c;
    if (typeof price !== "number" || !isFinite(price) || price <= 0) return null;

    const changePct = typeof r.dp === "number" && isFinite(r.dp) ? r.dp : null;
    return { price, changePct };
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();

  if (_cache && now - _cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ available: true, indices: _cache.indices, fetchedAt: _cache.at });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ available: false, indices: null, fetchedAt: now });
  }

  const indices = {} as IndicesMap;
  for (const symbol of SYMBOLS) {
    indices[symbol] = await fetchQuote(symbol, apiKey);
  }

  _cache = { indices, at: now };
  return NextResponse.json({ available: true, indices, fetchedAt: now });
}
