"use client";

/**
 * PİYASA CANLI NABIZ — arayüzün tepesinde dönen sınıflandırılmış haber
 * şeridi. newsStore'dan okur, ~8sn'de bir bir sonraki habere geçer.
 *
 * Sadece görsel/bilgilendirme katmanı — skor/GO kararına hiç girmez,
 * useScoreEngine/orchestrator'a dokunmaz. Anahtar kelime tabanlı
 * sınıflandırmanın sınırlarını netleştirmek için her zaman görünür bir
 * uyarı metni taşır (Anomali Badge'deki "otomatik sinyal değil" prensibiyle
 * aynı — burada tam genişlik banner olduğu için tap-to-show yerine kalıcı
 * metin yeterli).
 */

import { useEffect, useState } from "react";
import { useNewsStore } from "@/lib/store/newsStore";
import { useT } from "@/lib/i18n/context";
import type { NewsSentiment } from "@/lib/news/types";

const ROTATE_MS = 8_000;

const SENTIMENT_I18N_KEY: Record<NewsSentiment, string> = {
  positive: "marketPulse.positive",
  negative: "marketPulse.negative",
  neutral: "marketPulse.neutral",
};

const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
  positive: "text-signal-green bg-soft-green",
  negative: "text-signal-red bg-soft-red",
  neutral: "text-text-t3 bg-text-t3/10",
};

export function MarketPulseBanner(): React.ReactElement | null {
  const items = useNewsStore((s) => s.items);
  const t = useT();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const tid = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => clearInterval(tid);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[index % items.length];

  return (
    <div className="border-border bg-bg-card/60 flex items-center gap-2 border-b px-4 py-1.5 text-xs font-mono lg:px-6">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${SENTIMENT_CLASS[current.sentiment]}`}
      >
        {t(SENTIMENT_I18N_KEY[current.sentiment])}
      </span>
      <a
        href={current.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-t2 hover:text-text-t1 truncate transition-colors"
        title={current.title}
      >
        {current.title}
      </a>
      <span className="text-text-t4 ml-auto hidden shrink-0 sm:inline">
        {t("marketPulse.disclaimer")}
      </span>
    </div>
  );
}
