"use client";

/**
 * EQUITY MINI CARD — War Room mini kart şeridinin 4. kartı.
 * Diğer 3 kart (ActivePairMiniCard) QX halkası + MTF okları gösterir,
 * ama equity bir parite değil — skor/yön kavramı yok, bu yüzden
 * ActivePairMiniCard'a zorla uydurulmadı. Ayrı, basit bir kart: sadece
 * iki satır metin (toplam bakiye + günlük P&L%).
 *
 * Veri kaynağı: useAccountStore (lib/store/accountStore.ts) —
 * balanceTotal (toplam bakiye) + dailyPnlPct (günlük P&L%),
 * useBalancePoller(2000) ile besleniyor. Supabase'den DEĞİL, "portföy
 * hook'u" olarak usePortfolio gibi bir isim de YOK — proje genelinde
 * bakiye için TEK kaynak bu store (aynı kaynak daha önce MarketRibbon'ın
 * EQUITY item'ında da kullanılmıştı). Hardcoded değer yok.
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
    <div className="flex shrink-0 flex-col justify-center gap-0.5 rounded-lg border border-border/50 bg-surface-s1 px-3 py-2 font-mono">
      <span className="text-2xs font-mono uppercase tracking-wider text-text-t2/70 leading-none">
        EQUITY
      </span>
      <span className="whitespace-nowrap text-sm font-bold tabular-nums text-text-t1">
        {formatPrice(balanceTotal, locale)}
      </span>
      <span className="whitespace-nowrap text-[10px] font-bold" style={{ color }}>
        {dailyPnlPct >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(dailyPnlPct), locale)}
      </span>
    </div>
  );
}
