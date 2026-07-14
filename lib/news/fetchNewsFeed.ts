/**
 * HABER BESLEMESİ — CoinDesk + Cointelegraph RSS (birincil, kaynağın kendi
 * yayın kanalı — aracı yok) + Finnhub `/news?category=crypto` (tamamlayıcı,
 * ücretsiz key ile). Sunucu tarafında çalışır (app/api/news/route.ts) —
 * CORS yok, Finnhub key gizli kalır.
 *
 * XML parse: fast-xml-parser (regex değil) — RSS'in CDATA/encoding/nested
 * tag köşe durumlarında sessizce bozuk veri üretme riskini azaltır.
 *
 * Tüm ağ hataları yutulur ve boş dizi döner — bir kaynağın çökmesi
 * diğerlerini etkilemez, sayfa hiçbir zaman bu yüzden patlamaz.
 */

import { XMLParser } from "fast-xml-parser";
import { classifyHeadline } from "./sentimentClassifier";
import type { NewsItem } from "./types";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_ITEMS_PER_SOURCE = 15;
const MAX_TOTAL_ITEMS = 30;

const RSS_SOURCES: ReadonlyArray<{ source: "coindesk" | "cointelegraph"; url: string }> = [
  { source: "coindesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "cointelegraph", url: "https://cointelegraph.com/rss" },
];

const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: true });

async function fetchWithTimeout(url: string, headers?: Record<string, string>): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal, headers });
    clearTimeout(tid);
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

async function fetchRssSource(
  source: "coindesk" | "cointelegraph",
  url: string,
): Promise<NewsItem[]> {
  const res = await fetchWithTimeout(url, { "User-Agent": "QuantixOS/1.0 (+news-poller)" });
  if (!res) return [];

  try {
    const xml = await res.text();
    const parsed: unknown = xmlParser.parse(xml);
    const channel = (parsed as { rss?: { channel?: { item?: unknown } } })?.rss?.channel;
    const rawItems = channel?.item;
    const items: unknown[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    const out: NewsItem[] = [];
    for (const raw of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
      const item = raw as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title.trim() : null;
      const link = typeof item.link === "string" ? item.link.trim() : null;
      const pubDateRaw = typeof item.pubDate === "string" ? item.pubDate : null;
      if (!title || !link || !pubDateRaw) continue;

      const publishedAt = Date.parse(pubDateRaw);
      if (!isFinite(publishedAt)) continue;

      out.push({
        id: link,
        source,
        title,
        url: link,
        publishedAt,
        sentiment: classifyHeadline(title),
      });
    }
    return out;
  } catch {
    return [];
  }
}

interface FinnhubNewsRow {
  headline?: string;
  url?: string;
  datetime?: number; // epoch seconds
}

async function fetchFinnhubCrypto(apiKey: string): Promise<NewsItem[]> {
  const url = `https://finnhub.io/api/v1/news?category=crypto&token=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(url);
  if (!res) return [];

  try {
    const raw = (await res.json()) as unknown;
    if (!Array.isArray(raw)) return [];

    const out: NewsItem[] = [];
    for (const row of (raw as FinnhubNewsRow[]).slice(0, MAX_ITEMS_PER_SOURCE)) {
      if (!row.headline || !row.url || typeof row.datetime !== "number") continue;
      const title = row.headline.trim();
      out.push({
        id: row.url,
        source: "finnhub",
        title,
        url: row.url,
        publishedAt: row.datetime * 1000,
        sentiment: classifyHeadline(title),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Tüm kaynaklardan haber çek, birleştir, URL'e göre dedupe et, en yeniden
 * eskiye sırala. `finnhubApiKey` yoksa Finnhub sessizce atlanır — sadece
 * RSS kaynakları kullanılır, hata fırlatılmaz.
 */
export async function fetchAllNews(finnhubApiKey: string | undefined): Promise<NewsItem[]> {
  const tasks: Promise<NewsItem[]>[] = RSS_SOURCES.map((s) => fetchRssSource(s.source, s.url));
  if (finnhubApiKey) tasks.push(fetchFinnhubCrypto(finnhubApiKey));

  const results = await Promise.all(tasks);
  const merged = results.flat().sort((a, b) => b.publishedAt - a.publishedAt);

  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.slice(0, MAX_TOTAL_ITEMS);
}
