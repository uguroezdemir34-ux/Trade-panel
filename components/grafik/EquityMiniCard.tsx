"use client";

/**
 * EQUITY MINI CARD — kompakt tek satır rozet.
 * Önceden War Room mini kart şeridinin 4. kartıydı (2 satır, BTC/ETH/DXY
 * ile aynı yatay kaydırmalı şeritte) — şeritte sıkışıp kırpıldığı için
 * (ekran görüntüsüyle doğrulandı, "$797.9..." gibi kesiliyordu)
 * ChartControls'un zaman dilimi satırının sağındaki boş alana taşındı,
 * tek satırlık kompakt rozet olarak yeniden tasarlandı.
 *
 * DAVRANIŞ DEĞİŞİKLİĞİ: eskiden isOverlayActive (War Room / açık pozisyon)
 * gate'i altındaydı, artık ChartControls her zaman render edildiği için
 * bu rozet açık pozisyon olmasa da her zaman görünür — equity zaten
 * pozisyona bağlı bir kavram değil, bu daha tutarlı.
 *
 * Veri kaynağı: useAccountStore (lib/store/accountStore.ts) —
 * balanceTotal (toplam bakiye) + dailyPnlPct (günlük P&L%),
 * useBalancePoller(2000) ile besleniyor. Hardcoded değer yok.
 */

import { useAccountStore } from "@/lib/store/accountStore";
import { useLocale } from "@/lib/i18n/context";
import { formatPrice, formatPercent } from "@/lib/i18n/format";

const UP_COLOR = "#3ee97d";
const DOWN_COLOR = "#ff3b3b";

export function EquityMiniCard(): React.ReactElement | null {
  const balanceTotal = useAccountStore((s) => s.balanceTotal);
  const dailyPnlPct = useAccountStore((s) => s.dailyPnlPct);
  const locale = useLocale();

  if (balanceTotal <= 0) return null;

  const color = dailyPnlPct >= 0 ? UP_COLOR : DOWN_COLOR;

  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-border/50 bg-surface-s1 px-2 py-1 font-mono">
      <span className="text-2xs font-mono uppercase tracking-wider text-text-t2/70">
        EQUITY
      </span>
      <span className="text-2xs font-bold tabular-nums text-text-t1">
        {formatPrice(balanceTotal, locale)}
      </span>
      <span className="text-2xs font-bold" style={{ color }}>
        {dailyPnlPct >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(dailyPnlPct), locale)}
      </span>
    </div>
  );
}
