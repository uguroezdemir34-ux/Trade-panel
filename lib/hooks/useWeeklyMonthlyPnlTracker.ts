/**
 * WEEKLY/MONTHLY PNL TRACKER — Haftalık (ISO hafta, UTC Pazartesi başlangıcı)
 * ve aylık (takvim ayı, UTC) kümülatif P&L hesaplayıp accountStore'a yazar.
 *
 * Kaynak: tradesStore kapanmış trade'leri + accountStore bakiyesi.
 * Sınır hesabı lib/risk/equity-curve.ts (UTC) ile tutarlı — bilerek
 * useDailyPnlTracker'ın yerel saat yaklaşımından ayrı tutuluyor.
 *
 * Tetiklenme: tradesStore.trades veya balanceTotal değiştiğinde.
 * Sıfırlama: her çalışmada önce checkAndResetPeriods() çağrılır — hafta/ay
 * sınırı geçilmişse lastWeekly/MonthlyResetAt güncellenir, ardından bu hook
 * kendi hesapladığı doğru yüzdeyi yazar (checkAndResetPeriods'un geçici 0
 * ataması hemen üzerine yazılır).
 */

"use client";

import { useEffect } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useAccountStore } from "@/lib/store/accountStore";
import { getWeekStart, getMonthStart } from "@/lib/risk/equity-curve";

export function useWeeklyMonthlyPnlTracker(): void {
  const trades = useTradesStore((s) => s.trades);
  const balanceTotal = useAccountStore((s) => s.balanceTotal);
  const setWeeklyPnlPct = useAccountStore((s) => s.setWeeklyPnlPct);
  const setMonthlyPnlPct = useAccountStore((s) => s.setMonthlyPnlPct);
  const checkAndResetPeriods = useAccountStore((s) => s.checkAndResetPeriods);

  useEffect(() => {
    const now = Date.now();
    checkAndResetPeriods(now);

    const weekStart = getWeekStart(now);
    const monthStart = getMonthStart(now);

    const closedTrades = trades.filter((t) => t.status === "closed" && t.exit);

    const weekPnlUsd = closedTrades
      .filter((t) => t.exit!.closedAt >= weekStart)
      .reduce((sum, t) => sum + (t.exit?.pnlUsd ?? 0), 0);

    const monthPnlUsd = closedTrades
      .filter((t) => t.exit!.closedAt >= monthStart)
      .reduce((sum, t) => sum + (t.exit?.pnlUsd ?? 0), 0);

    const startOfWeekBalance = balanceTotal - weekPnlUsd;
    const weekSafeBase = startOfWeekBalance > 0 ? startOfWeekBalance : balanceTotal;
    const weeklyPnlPct = weekSafeBase > 0 ? (weekPnlUsd / weekSafeBase) * 100 : 0;

    const startOfMonthBalance = balanceTotal - monthPnlUsd;
    const monthSafeBase = startOfMonthBalance > 0 ? startOfMonthBalance : balanceTotal;
    const monthlyPnlPct = monthSafeBase > 0 ? (monthPnlUsd / monthSafeBase) * 100 : 0;

    setWeeklyPnlPct(weeklyPnlPct);
    setMonthlyPnlPct(monthlyPnlPct);
  }, [trades, balanceTotal, setWeeklyPnlPct, setMonthlyPnlPct, checkAndResetPeriods]);
}
