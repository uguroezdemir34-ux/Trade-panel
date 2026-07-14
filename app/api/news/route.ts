/**
 * /api/news — CoinDesk + Cointelegraph RSS + Finnhub crypto haber proxy.
 *
 * Sunucu tarafında fetch + XML parse (fast-xml-parser) + anahtar kelime
 * sınıflandırma (lib/news/*). 10dk sunucu-tarafı cache — useNewsPoller
 * 15-30dk'da bir çağırır, cache TTL o pencerenin altında kalır.
 *
 * Auth: FINNHUB_API_KEY (Vercel env, MANUEL eklenmeli — Clerk/Stripe env
 * var'ları gibi kullanıcı aksiyonu bekliyor, bkz. CLAUDE.md §13). Key
 * yoksa Finnhub sessizce atlanır, sadece RSS kaynakları kullanılır.
 */

import { NextResponse } from "next/server";
import { fetchAllNews } from "@/lib/news/fetchNewsFeed";
import type { NewsItem } from "@/lib/news/types";

const CACHE_TTL_MS = 10 * 60_000;

let _cache: { items: NewsItem[]; at: number } | null = null;

export async function GET() {
  const now = Date.now();

  if (_cache && now - _cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ items: _cache.items, fetchedAt: _cache.at });
  }

  const items = await fetchAllNews(process.env.FINNHUB_API_KEY);
  _cache = { items, at: now };
  return NextResponse.json({ items, fetchedAt: now });
}
