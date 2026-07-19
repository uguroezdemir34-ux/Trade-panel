"use client";

/**
 * HABER AKIŞI — arayüzün tepesinde dönen sınıflandırılmış haber şeridi.
 * newsStore'dan okur, ~8sn'de bir bir sonraki habere geçer.
 *
 * Not: components/karar/MarketPulseWidget.tsx (sabit %62 "AI Sentiment
 * Index" kartı) ile İSİM/KAVRAM OLARAK KARIŞTIRILMASIN — o ayrı, önceden
 * var olan, gerçek veriye hiç bağlanmamış bir placeholder (bkz. CLAUDE.md
 * §9 backlog notu). Bu component bilinçli olarak "Market Pulse"/"Sentiment"
 * adlandırmasından kaçınır.
 *
 * Sadece görsel/bilgilendirme katmanı — skor/GO kararına hiç girmez,
 * useScoreEngine/orchestrator'a dokunmaz. Anahtar kelime tabanlı
 * sınıflandırmanın sınırlarını netleştirmek için her zaman görünür bir
 * uyarı metni taşır (Anomali Badge'deki "otomatik sinyal değil" prensibiyle
 * aynı — burada tam genişlik banner olduğu için tap-to-show yerine kalıcı
 * metin yeterli).
 *
 * Sticky pozisyon: AppHeader'ın hemen altında sabit kalır (top-14 —
 * AlarmToastContainer.tsx'teki aynı yaklaşık header-yüksekliği yaklaşımı,
 * header'ın kendi yüksekliği env(safe-area-inset-top) yüzünden sabit
 * değil). backdrop-blur KULLANILMADI (mobil perf kararı, bkz. CLAUDE.md
 * §9) — bunun yerine düz opak `bg-bg`.
 *
 * --news-banner-h: bir ResizeObserver ile document.documentElement'e CSS
 * custom property olarak yazılır (aynı inline-ResizeObserver deseni
 * PriceChart.tsx'te de kullanılıyor, ayrı bir hook'a çıkarmaya gerek
 * görülmedi). TickerTape.tsx bunu kendi sticky top offset'i için okuyor.
 *
 * DİKKAT — isim yanıltıcı olabilir ama bilinçli: bu değişken banner'ın
 * KENDİ yüksekliğini değil, `getBoundingClientRect().bottom`'unu (viewport
 * tepesinden banner'ın alt kenarına kadar KÜMÜLATİF mesafe — AppHeader +
 * banner toplamı) tutar. Sadece kendi yüksekliğini yazsaydık, TickerTape
 * bunu doğrudan `top` yapınca AppHeader'ın yüksekliğini atlayıp header'ın
 * altına/banner'ın üstüne çakışarak yerleşirdi. line-clamp-3 nedeniyle
 * banner 1-3 satır arasında yükseklik değiştirdiğinde ResizeObserver
 * otomatik tetiklenir.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useNewsStore } from "@/lib/store/newsStore";
import { useT } from "@/lib/i18n/context";
import type { NewsSentiment } from "@/lib/news/types";

const ROTATE_MS = 8_000;

/** app/haberler/page.tsx ile paylaşılır — aynı renk/etiket eşlemesini tekrarlamamak için export edildi. */
export const SENTIMENT_I18N_KEY: Record<NewsSentiment, string> = {
  positive: "newsFeed.positive",
  negative: "newsFeed.negative",
  neutral: "newsFeed.neutral",
};

export const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
  positive: "text-signal-green bg-soft-green",
  negative: "text-signal-red bg-soft-red",
  neutral: "text-text-t3 bg-text-t3/10",
};

/**
 * "Tümünü Gör" linkinin ikonu — orijinal, elle çizilmiş bir gazete/makale
 * glifi. lucide-react bu projede kurulu değil (package.json'da doğrulandı,
 * npm install bu sandbox'ta engelli — CLAUDE.md §3) ve bu sandbox'ın dış ağ
 * politikası lucide'ın gerçek "Newspaper" ikonunun tam SVG path verisini
 * doğrulamak için gereken fetch'leri de engelliyor (bkz. PositionAccordion.
 * tsx'teki TrendingUpIcon — orada path verisi doğrulanabilmişti, burada
 * doğrulanamadı) — yanlış hatırlanan path verisiyle bozuk bir ikon
 * riske girmek yerine, aynı stroke stilini (currentColor, 2px, yuvarlak
 * uçlar) kullanan basit/orijinal bir glif tercih edildi.
 */
function NewspaperIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="13" y2="16" />
    </svg>
  );
}

export function NewsFeedBanner(): React.ReactElement | null {
  const items = useNewsStore((s) => s.items);
  const t = useT();
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    const tid = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(tid);
  }, [items.length]);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) {
      document.documentElement.style.setProperty("--news-banner-h", "3.5rem");
      return;
    }
    const setOffset = () => {
      document.documentElement.style.setProperty("--news-banner-h", `${el.getBoundingClientRect().bottom}px`);
    };
    setOffset();
    const ro = new ResizeObserver(setOffset);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  // /grafik dikey alan kazanımı — chart sayfasında header'la birlikte gizlenir.
  if (pathname === "/grafik" || items.length === 0) return null;

  const current = items[index % items.length];

  return (
    <div
      ref={bannerRef}
      className="border-border bg-bg sticky top-14 z-40 flex items-start gap-2 border-b px-4 py-1.5 text-xs font-mono lg:px-6"
    >
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${SENTIMENT_CLASS[current.sentiment]}`}
      >
        {t(SENTIMENT_I18N_KEY[current.sentiment])}
      </span>
      <a
        href={current.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-t2 hover:text-text-t1 line-clamp-3 whitespace-normal break-words transition-colors"
        title={current.title}
      >
        {current.title}
        {/* Dış link ipucu — tıklanabilirlik önceden görsel olarak hiç
            belli değildi (kullanıcı tesadüfen keşfetmişti). lucide-react
            kurulu değil (bkz. PositionAccordion.tsx'teki aynı gerekçe) —
            basit Unicode ok karakteri, kod tabanının geri kalanındaki
            yerleşik "→"/"✕" deseniyle tutarlı. target="_blank" zaten
            mevcuttu (yeni sekmede açılır, QUANTIX OS sekmesi arkada kalır)
            — bu değişiklik sadece görünürlük ekliyor. İlk sürümde text-t4
            (soluk gri) + varsayılan boyuttu, fark edilmiyordu — link'in
            kendi rengiyle (text-text-t2, hover'da text-text-t1) eşleşecek
            + text-sm ile bir tık büyütüldü. */}
        <span className="text-text-t2 ml-1 inline-block text-sm" aria-hidden="true">
          ↗
        </span>
      </a>
      {/*
        Hit-area >= 44x44dp (Apple HIG) / 48x48dp (Material): p-3 (12px)
        ikonun (h-6 w-6 = 24px) her yönüne eklenince 48x48'e ulaşır (24px
        ikon, önceki 20px'lik sürümden daha güçlü bir görsel ipucu verir).
        -my-3 bu dikey padding'in banner'ın kendi yüksekliğini büyütmesini
        engeller (yatay padding'in flex genişliğine etkisi önemsiz, negate
        edilmedi — ml-auto ile aynı property'yi (margin-left) hedefleyip
        çakışmasın diye sadece dikey negate edildi).
      */}
      <Link
        href="/haberler"
        aria-label={t("newsFeed.viewAll")}
        title={t("newsFeed.viewAll")}
        className="text-text-t3 hover:text-text-t1 ml-auto -my-3 flex shrink-0 items-center gap-1 p-3 transition-colors"
      >
        <NewspaperIcon className="h-6 w-6 shrink-0" />
        <span className="hidden sm:inline">{t("newsFeed.viewAll")}</span>
      </Link>
      <span className="text-text-t4 hidden shrink-0 sm:inline">
        {t("newsFeed.disclaimer")}
      </span>
    </div>
  );
}
