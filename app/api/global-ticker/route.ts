/**
 * /api/global-ticker — Altın, Gümüş, Brent, AAPL, NVDA, TSLA (Yahoo
 * Finance, gayri-resmi chart endpoint). 60sn sunucu-tarafı cache — bkz.
 * app/api/news/route.ts'teki aynı in-memory cache deseni (Next.js fetch
 * Data Cache'i — `next: { revalidate }` — yerine bilerek).
 *
 * S&P 500/NASDAQ/DOW/DXY BİLEREK YOK — equityIndexStore/useEquityIndexPoller
 * zaten bunları farklı bir kaynaktan (SPY/QQQ/DIA/UUP proxy'leri) çekip
 * skor motoruna da besliyor (composeScoreInput). Önceki sürümde bu route
 * ^GSPC/^IXIC/DXY'i de çekiyordu ama useMarketExtrasPoller onları hiç
 * kullanmıyordu (mükerrer rozet riski) — gereksiz Yahoo çağrısı kaldırıldı.
 */

import { NextResponse } from 'next/server';

interface GlobalTickerAsset {
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
}

const CACHE_TTL_MS = 60_000;
let _cache: { data: GlobalTickerAsset[]; at: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (_cache && now - _cache.at < CACHE_TTL_MS) {
    return NextResponse.json(_cache.data);
  }

  const assets = [
    { symbol: 'GC=F', name: 'GOLD' },
    { symbol: 'SI=F', name: 'SILVER' },
    { symbol: 'BZ=F', name: 'BRENT' },
    { symbol: 'AAPL', name: 'AAPL' },
    { symbol: 'NVDA', name: 'NVDA' },
    { symbol: 'TSLA', name: 'TSLA' }
  ];

  try {
    const data = await Promise.all(
      assets.map(async (asset) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${asset.symbol}?interval=1d&range=1s`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }
          );
          const json = await res.json();
          const meta = json.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prevClose = meta.previousClose;
          const change = ((price - prevClose) / prevClose) * 100;

          return {
            name: asset.name,
            price: price.toLocaleString('en-US', {
              minimumFractionDigits: asset.name === 'SILVER' ? 3 : 2,
              maximumFractionDigits: asset.name === 'SILVER' ? 3 : 2
            }),
            change: change.toFixed(2),
            isPositive: change >= 0
          };
        } catch (err) {
          console.error(`Error fetching ${asset.name}:`, err);
          return { name: asset.name, price: 'N/A', change: '0.00', isPositive: true };
        }
      })
    );

    _cache = { data, at: now };
    return NextResponse.json(data);
  } catch (error) {
    console.error('[/api/global-ticker]', error);
    return NextResponse.json({ error: 'Failed to fetch global ticker' }, { status: 500 });
  }
}
