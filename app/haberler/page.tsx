"use client";

/**
 * /haberler — NewsFeedBanner'daki tek-satır dönen şeridin tam listesi +
 * Faz 1 Haber Terminali modülleri (kullanıcı onayıyla bu sayfaya
 * eklendi, ayrı bir route açılmadı):
 * - Ekonomik takvim (lib/news/economicCalendar.ts, statik/elle bakımlı
 *   liste — canlı API yok, bkz. o dosyanın header'ı).
 * - Regülasyon/listeleme haberlerinde kural bazlı "Piyasa Etkisi" rozeti
 *   (lib/news/regulatoryClassifier.ts — genel sentiment'ten bağımsız,
 *   ayrı bir olay-tipi eşlemesi).
 *
 * newsStore'u okur (useNewsPoller zaten AppShell'de global olarak
 * dolduruyor, bu sayfa kendi fetch'ini yapmaz), sentiment'e göre
 * client-side filtreler. Yeni bir API çağrısı yok.
 */

import { useEffect, useMemo, useState } from "react";
import { useNewsStore } from "@/lib/store/newsStore";
import { useT } from "@/lib/i18n/context";
import { SENTIMENT_CLASS, SENTIMENT_I18N_KEY } from "@/components/layout/NewsFeedBanner";
import { getUpcomingCalendarEvents } from "@/lib/news/economicCalendar";
import { classifyMarketImpact, isRegulatoryOrListingNews } from "@/lib/news/regulatoryClassifier";
import type { NewsItem, NewsSentiment } from "@/lib/news/types";

type FilterTab = "all" | NewsSentiment;
type TFn = (path: string, params?: Record<string, string | number>) => string;

const FILTER_TABS: FilterTab[] = ["all", "positive", "negative", "neutral"];
const MAX_CALENDAR_ROWS = 5;
const CALENDAR_TICK_MS = 60_000;

const SOURCE_LABEL: Record<NewsItem["source"], string> = {
  coindesk: "CoinDesk",
  cointelegraph: "Cointelegraph",
  finnhub: "Finnhub",
};

function formatRelativeTime(epochMs: number, t: TFn): string {
  const diffMs = Date.now() - epochMs;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("newsFeed.timeJustNow");
  if (minutes < 60) return t("newsFeed.timeMinutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("newsFeed.timeHoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("newsFeed.timeDaysAgo", { n: days });
}

/** Geri sayım — gün/saat/dakika bileşik format, common.time* key'lerini yeniden kullanır. */
function formatCountdown(targetMs: number, nowMs: number, t: TFn): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return t("common.timeNow");
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${t("common.timeDays", { n: days })} ${t("common.timeHours", { n: hours })}`;
  if (hours > 0) return `${t("common.timeHours", { n: hours })} ${t("common.timeMinutes", { n: minutes })}`;
  return t("common.timeMinutes", { n: minutes });
}

export default function HaberlerPage(): React.ReactElement {
  const items = useNewsStore((s) => s.items);
  const t = useT();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const tid = setInterval(() => setNowMs(Date.now()), CALENDAR_TICK_MS);
    return () => clearInterval(tid);
  }, []);

  const upcomingEvents = useMemo(
    () => getUpcomingCalendarEvents(nowMs).slice(0, MAX_CALENDAR_ROWS),
    [nowMs],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => item.sentiment === filter);
  }, [items, filter]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-text-t1 font-mono text-sm tracking-widest">{t("newsFeed.pageTitle")}</h1>

      <div
        className="border-border bg-bg sticky z-30 flex flex-col gap-1.5 rounded-lg border p-3"
        style={{ top: "var(--news-banner-h, 3.5rem)" }}
      >
        <h2 className="text-text-t2 font-mono text-xs tracking-widest">{t("newsFeed.calendar.title")}</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-text-t4 font-mono text-[10px]">{t("newsFeed.calendar.empty")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {upcomingEvents.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-text-t2 flex items-center gap-1.5">
                  <span className="bg-signal-red inline-block h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
                  {t(ev.nameKey)}
                </span>
                <span className="text-text-t3 shrink-0">{formatCountdown(ev.atMs, nowMs, t)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

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
          {filtered.map((item) => {
            const isRegulatory = isRegulatoryOrListingNews(item.title);
            const impact = isRegulatory ? classifyMarketImpact(item.title) : null;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-bg-card hover:border-text-t3 flex flex-col gap-1.5 rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Impact (dar/kural-bazlı) ile genel sentiment (geniş/gevşek NLP)
                      çelişebilir — kullanıcı onayıyla: çakışmada Impact kazanır,
                      sentiment gizlenir (tek rozet, kullanıcıya "hangisine
                      güveneyim" sorusu bırakmaz). Dar-kapsamlı + açıkça
                      "(kural bazlı)" etiketli olan, geniş-kapsamlı olana göre
                      önceliklidir. */}
                  <div className="flex shrink-0 flex-col items-start gap-1">
                    {impact !== null ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap ${SENTIMENT_CLASS[impact]}`}
                      >
                        {t("newsFeed.impactPrefix")} {t(SENTIMENT_I18N_KEY[impact])} {t("newsFeed.impactSuffix")}
                      </span>
                    ) : (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${SENTIMENT_CLASS[item.sentiment]}`}
                      >
                        {t(SENTIMENT_I18N_KEY[item.sentiment])}
                      </span>
                    )}
                  </div>
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
            );
          })}
        </div>
      )}

      <p className="text-text-t4 font-mono text-[10px]">{t("newsFeed.disclaimer")}</p>
    </div>
  );
}
