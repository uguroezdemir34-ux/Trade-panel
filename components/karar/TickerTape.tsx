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
 * marketStore.prices'ı (zaten useMarketStream ile canlı besleniyor) ve
 * equityIndexStore'u (SPY/QQQ/UUP → "S&P 500"/"NASDAQ"/"DXY" olarak
 * gösterilir, useEquityIndexPoller AppShell'de ayrıca besliyor) okur —
 * bu dosya kendi fetch/poller'ını yapmaz, salt tüketici. Snapshot null'sa
 * (poller ilk cycle'ı bitirmedi / key yok / Finnhub hatası) o üç öğe
 * tamamen render edilmez, kripto şeridini etkilemez. Pair tipine hiç
 * girmez, skor motoruna hiç dokunmaz.
 *
 * Sticky pozisyon: NewsFeedBanner'ın (ayrı dosya, ayrı sayfa kapsamı —
 * global layout'ta) hemen altında sabit kalır. Kendi top-offset'ini
 * bilmiyor/hesaplamıyor — NewsFeedBanner.tsx'in bir ResizeObserver ile
 * yazdığı `--news-banner-h` CSS custom property'sini (document.
 * documentElement üzerinde) okuyarak dinamik olarak alır, bu sayede
 * banner line-clamp-2 nedeniyle 1/2 satır arasında yükseklik
 * değiştirdiğinde otomatik senkron kalır. İki dosya arasında doğrudan
 * import/prop bağımlılığı yok — sadece CSS değişkeni üzerinden gevşek
 * bağlı, mimari (global vs. /karar'a özel) korunuyor. backdrop-blur
 * KULLANILMADI (mobil perf kararı, bkz. CLAUDE.md §9) — opak `bg-bg`.
 */

import { memo } from "react";
import { PAIRS } from "@/lib/constants/pairs";
import { useMarketStore } from "@/lib/store/marketStore";
import { useEquityIndexStore, type EquityIndexSnapshot } from "@/lib/store/equityIndexStore";
import { useT, useLocale } from "@/lib/i18n/context";
import { formatTickPrice, formatPercent } from "@/lib/i18n/format";

// SPY/QQQ/UUP teknik proxy sembolleri — kullanıcıya gerçek endeks adlarıyla
// gösterilir (ETF proxy olduğu iç detay, bkz. equityIndexStore.ts header'ı).
const EQUITY_INDEX_LABELS: { key: "spy" | "qqq" | "uup"; label: string }[] = [
  { key: "spy", label: "S&P 500" },
  { key: "qqq", label: "NASDAQ" },
  { key: "uup", label: "DXY" },
];

function TickerTapeImpl(): React.ReactElement {
  const prices = useMarketStore((s) => s.prices);
  const spy = useEquityIndexStore((s) => s.spy);
  const qqq = useEquityIndexStore((s) => s.qqq);
  const uup = useEquityIndexStore((s) => s.uup);
  const locale = useLocale();
  const t = useT();

  const equitySnapshots: Record<"spy" | "qqq" | "uup", EquityIndexSnapshot | null> = {
    spy,
    qqq,
    uup,
  };
  const hasAnyEquityIndex = spy !== null || qqq !== null || uup !== null;

  const renderItems = (keyPrefix: string) => (
    <>
      {PAIRS.map((pair) => {
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
      })}
      {hasAnyEquityIndex && (
        <span
          key={`${keyPrefix}-us-markets-label`}
          className="border-border flex shrink-0 items-center border-l pl-3 text-text-t3 text-[9px] tracking-wide"
        >
          {t("karar.usMarketsLabel")}
        </span>
      )}
      {EQUITY_INDEX_LABELS.map(({ key, label }) => {
        const snap = equitySnapshots[key];
        // Poller henüz ilk cycle'ı tamamlamadıysa / key yoksa / Finnhub
        // hatasıysa snap null olur — bu durumda öğe tamamen render edilmez,
        // kripto şeridini hiç etkilemez (bkz. görev kısıtı).
        if (!snap) return null;
        const chg = snap.changePct;
        const chgColor =
          chg === null ? "text-text-t4" : chg >= 0 ? "text-signal-up" : "text-signal-down";
        const arrow = chg === null ? "" : chg >= 0 ? "▲" : "▼";

        return (
          <span key={`${keyPrefix}-${key}`} className="flex shrink-0 items-center gap-1.5">
            <span className="text-text-t2 font-bold">{label}</span>
            <span className="text-text-t1">{formatTickPrice(snap.price, locale)}</span>
            <span className={chgColor}>
              {chg === null ? "—" : `${arrow} ${formatPercent(Math.abs(chg), locale)}`}
            </span>
          </span>
        );
      })}
    </>
  );

  return (
    <div
      className="ticker-tape-viewport border-border bg-bg sticky z-40 overflow-hidden border-b"
      style={{ top: "var(--news-banner-h, 3.5rem)" }}
    >
      <div className="ticker-tape-track animate-[ticker-scroll_45s_linear_infinite] flex w-max items-center gap-6 py-1.5 font-mono text-[10px] will-change-transform">
        {renderItems("a")}
        {renderItems("b")}
      </div>
    </div>
  );
}

// Prop almıyor — memo, ilgisiz kardeş state değişikliklerinden (KararPage'in
// kendisi her WS tick'inde re-render oluyor) kaynaklanan gereksiz
// re-render'ları önler. TickerTape kendi store aboneliklerinde değiştiğinde
// (fiyat/equity index tick'i) hâlâ normal şekilde render olur — memo sadece
// parent'tan gelen alakasız tetiklemeleri filtreler.
export const TickerTape = memo(TickerTapeImpl);
