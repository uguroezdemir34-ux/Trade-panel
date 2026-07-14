"use client";

/**
 * DXY MINI CARD — War Room mini kart şeridinin DXY kartı.
 * EquityMiniCard ile AYNI basit iki-satır formatı: etiket + değer +
 * günlük % değişim. DXY bir parite değil (skor/yön/MTF kavramı yok),
 * bu yüzden ActivePairMiniCard'a değil, EquityMiniCard'ın deseni
 * izlendi.
 *
 * Veri kaynağı: equityIndexStore.uup (lib/store/equityIndexStore.ts) —
 * SPY/QQQ/UUP/DOW proxy'lerinden UUP = DXY (Dolar Endeksi),
 * useEquityIndexPoller ile besleniyor. Bu SADECE OKUNUYOR — aynı store
 * lib/hooks/useScoreEngine.ts:224'te composeScoreInput → dxyChangePct
 * olarak skor motoruna da giriyor, ama bu component lib/score/*'a veya
 * lib/macro/'ya hiç YAZMIYOR/dokunmuyor, salt tüketici (MarketRibbon.tsx
 * daha önce aynı store'u aynı şekilde okumuştu).
 */

import { useEquityIndexStore } from "@/lib/store/equityIndexStore";
import { useLocale } from "@/lib/i18n/context";
import { formatTickPrice, formatPercent } from "@/lib/i18n/format";

const UP_COLOR = "#3ee97d";
const DOWN_COLOR = "#ff3b3b";

export function DxyMiniCard(): React.ReactElement | null {
  const dxy = useEquityIndexStore((s) => s.uup);
  const locale = useLocale();

  if (!dxy) return null;

  const chg = dxy.changePct;
  const color = chg === null ? undefined : chg >= 0 ? UP_COLOR : DOWN_COLOR;

  return (
    <div className="flex shrink-0 flex-col justify-center gap-0.5 rounded-lg border border-border/50 bg-surface-s1 px-3 py-2 font-mono">
      <span className="text-2xs font-mono uppercase tracking-wider text-text-t2/70 leading-none">
        DXY
      </span>
      <span className="whitespace-nowrap text-sm font-bold tabular-nums text-text-t1">
        {formatTickPrice(dxy.price, locale)}
      </span>
      {chg !== null ? (
        <span className="whitespace-nowrap text-[10px] font-bold" style={{ color }}>
          {chg >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(chg), locale)}
        </span>
      ) : (
        <span className="whitespace-nowrap text-[10px] text-text-t4">—</span>
      )}
    </div>
  );
}
