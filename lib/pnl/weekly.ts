/**
 * WEEKLY AGGREGATES — Trade list → haftalık özet.
 *
 * ISO hafta: Pazartesi başlar.
 * Son N hafta döner (boş haftalar dahil, sıfır değerli).
 */

import type { TradeRecord } from "./types";

export interface WeeklyAggregate {
  /** Haftanın Pazartesi başlangıcı (epoch ms) */
  weekStart: number;
  /** Kısa etiket: "W01", "W02" veya "Jan 5" tarzı */
  weekLabel: string;
  tradeCount: number;
  totalPnlUsd: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

/** Bir timestamp'in ait olduğu Pazartesi günü başlangıcını döner */
function getMondayStart(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const toMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + toMonday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekLabel(mondayMs: number): string {
  const d = new Date(mondayMs);
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}`;
}

/**
 * Son `weeksBack` haftayı döner.
 * Trade olmayan haftalar sıfır değerle dahil edilir.
 */
export function computeWeeklyAggregates(
  trades: readonly TradeRecord[],
  weeksBack = 8,
  now: number = Date.now(),
): WeeklyAggregate[] {
  // Bu haftanın Pazartesi'sinden geriye git
  const thisMonday = getMondayStart(now);

  // Trade'leri Pazartesi bazında grupla
  const byWeek = new Map<number, TradeRecord[]>();
  for (const t of trades) {
    const key = getMondayStart(t.closedAt);
    const arr = byWeek.get(key);
    if (arr) arr.push(t);
    else byWeek.set(key, [t]);
  }

  const result: WeeklyAggregate[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = thisMonday - i * 7 * 86_400_000;
    const dayTrades = byWeek.get(weekStart) ?? [];
    const totalPnlUsd = dayTrades.reduce((s, t) => s + t.pnlUsd, 0);
    const winCount = dayTrades.filter((t) => t.pnlUsd > 0).length;
    const lossCount = dayTrades.filter((t) => t.pnlUsd < 0).length;

    result.push({
      weekStart,
      weekLabel: weekLabel(weekStart),
      tradeCount: dayTrades.length,
      totalPnlUsd,
      winCount,
      lossCount,
      winRate: dayTrades.length > 0 ? winCount / dayTrades.length : 0,
    });
  }

  return result;
}
