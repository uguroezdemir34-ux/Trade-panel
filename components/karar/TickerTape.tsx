"use client";

/**
 * TICKER TAPE — üstte sürekli akan fiyat şeridi (24 pair, canlı fiyat + %chg).
 *
 * Teknik kısıt (bilinçli, Görsel Kalite Paketi araştırmasının sonucu —
 * bkz. CLAUDE.md §9): SADECE CSS transform + will-change ile animasyon,
 * requestAnimationFrame KULLANILMIYOR. Transform tabanlı animasyon GPU
 * compositor thread'inde çalışır — useScoreEngine'in ana thread'i meşgul
 * ettiği anlarda bile bağımsız kalır. rAF ise aynı ana thread'i paylaşıp
 * mevcut mobil performans sorunuyla rekabet ederdi.
 *
 * Liste iki kez art arda render edilir (`ticker-scroll` keyframe'i
 * translateX(-50%) ile döner) — bu, tek bir kopyanın genişliği kadar
 * kaydıktan sonra başa sarma illüzyonu yaratır (sonsuz döngü hissi).
 *
 * Sadece marketStore.prices'ı okur (zaten useMarketStream ile canlı
 * besleniyor) — yeni fetch/poller/store yok, skor motoruna hiç dokunmaz.
 */

import { PAIRS } from "@/lib/constants/pairs";
import { useMarketStore } from "@/lib/store/marketStore";
import { useLocale } from "@/lib/i18n/context";
import { formatTickPrice, formatPercent } from "@/lib/i18n/format";

export function TickerTape(): React.ReactElement {
  const prices = useMarketStore((s) => s.prices);
  const locale = useLocale();

  const renderItems = (keyPrefix: string) =>
    PAIRS.map((pair) => {
      const tick = prices[pair];
      const chg = tick?.chg ?? null;
      const chgColor =
        chg === null ? "text-text-t4" : chg >= 0 ? "text-signal-up" : "text-signal-down";
      const arrow = chg === null ? "" : chg >= 0 ? "▲" : "▼";

      return (
        <span key={`${keyPrefix}-${pair}`} className="flex shrink-0 items-center gap-1.5">
          <span className="text-text-t2 font-bold">{pair}</span>
          <span className="text-text-t1">
            {tick?.last ? formatTickPrice(tick.last, locale) : "—"}
          </span>
          <span className={chgColor}>
            {chg === null ? "—" : `${arrow} ${formatPercent(Math.abs(chg), locale)}`}
          </span>
        </span>
      );
    });

  return (
    <div className="ticker-tape-viewport border-border bg-bg-card/40 overflow-hidden border-b">
      <div className="ticker-tape-track animate-[ticker-scroll_45s_linear_infinite] flex w-max items-center gap-6 py-1.5 font-mono text-[10px] will-change-transform">
        {renderItems("a")}
        {renderItems("b")}
      </div>
    </div>
  );
}
