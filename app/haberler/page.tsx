"use client";

/**
 * /haberler — NewsFeedBanner'daki tek-satır dönen şeridin tam listesi.
 * newsStore'u okur (useNewsPoller zaten AppShell'de global olarak
 * dolduruyor, bu sayfa kendi fetch'ini yapmaz), sentiment'e göre
 * client-side filtreler. Yeni bir API çağrısı yok.
 */

import { useMemo, useState } from "react";
import { useNewsStore } from "@/lib/store/newsStore";
import { useT } from "@/lib/i18n/context";
import { SENTIMENT_CLASS, SENTIMENT_I18N_KEY } from "@/components/layout/NewsFeedBanner";
import type { NewsItem, NewsSentiment } from "@/lib/news/types";

type FilterTab = "all" | NewsSentiment;

const FILTER_TABS: FilterTab[] = ["all", "positive", "negative", "neutral"];

const SOURCE_LABEL: Record<NewsItem["source"], string> = {
  coindesk: "CoinDesk",
  cointelegraph: "Cointelegraph",
  finnhub: "Finnhub",
};

function formatRelativeTime(epochMs: number, t: (path: string, params?: Record<string, string | number>) => string): string {
  const diffMs = Date.now() - epochMs;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("newsFeed.timeJustNow");
  if (minutes < 60) return t("newsFeed.timeMinutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("newsFeed.timeHoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("newsFeed.timeDaysAgo", { n: days });
}

export default function HaberlerPage(): React.ReactElement {
  const items = useNewsStore((s) => s.items);
  const t = useT();
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.sentiment === filter);
  }, [items, filter]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-text-t1 font-mono text-sm tracking-widest">{t("newsFeed.pageTitle")}</h1>

      <div className="flex gap-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded px-2.5 py-1 font-mono text-xs tracking-wider transition-colors ${
              filter === tab ? "bg-surface-s2 text-text-t1" : "text-text-t3 hover:text-text-t2"
            }`}
          >
            {tab === "all" ? t("newsFeed.filterAll") : t(SENTIMENT_I18N_KEY[tab])}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-text-t3 font-mono text-xs">{t("newsFeed.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border bg-bg-card hover:border-text-t3 flex flex-col gap-1.5 rounded-lg border p-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${SENTIMENT_CLASS[item.sentiment]}`}
                >
                  {t(SENTIMENT_I18N_KEY[item.sentiment])}
                </span>
                <span className="text-text-t2 flex-1 text-sm leading-snug">
                  {item.title}
                  <span className="text-text-t2 ml-1 inline-block text-sm" aria-hidden="true">
                    ↗
                  </span>
                </span>
              </div>
              <div className="text-text-t4 flex items-center gap-2 font-mono text-[10px]">
                <span>{SOURCE_LABEL[item.source]}</span>
                <span>·</span>
                <span>{formatRelativeTime(item.publishedAt, t)}</span>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="text-text-t4 font-mono text-[10px]">{t("newsFeed.disclaimer")}</p>
    </div>
  );
}
