"use client";

import { usePositionStore } from "@/lib/store/positionStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { PositionCard } from "@/components/pozisyon/PositionCard";
import { PositionEmptyState } from "@/components/pozisyon/PositionEmptyState";
import { TradeTimelineCard } from "@/components/pozisyon/TradeTimelineCard";
import { PortfolioSummaryBanner } from "@/components/pozisyon/PortfolioSummaryBanner";
import { AccountSummaryBar } from "@/components/pozisyon/AccountSummaryBar";
import { useT } from "@/lib/i18n/context";

export default function PozisyonPage() {
  const t = useT();
  const positions = usePositionStore((s) => s.positions);
  const closingInstId = usePositionStore((s) => s.closingInstId);
  const trades = useTradesStore((s) => s.trades);
  const updateTradeSlTp = useTradesStore((s) => s.updateTradeSlTp);
  const openTrades = trades.filter((tr) => tr.status === "open");

  return (
    <div className="flex flex-col gap-4">

      {/* Hesap özeti */}
      <AccountSummaryBar />

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-mono text-xs text-amber-400">
        <span className="font-bold tracking-widest mr-2">{t("settings.signalModeLabel")}</span>
        {t("settings.signalModeManageExchange")}
      </div>

      {positions.length === 0 ? (
        <PositionEmptyState />
      ) : (
        <>
          {positions.length >= 1 && (
            <PortfolioSummaryBanner positions={positions} />
          )}
          {positions.map((pos) => {
            const matchingTrade = openTrades
              .filter((t) => t.pair === pos.pair && t.direction === pos.direction)
              .sort((a, b) => b.openedAt - a.openedAt)[0];

            return (
              <PositionCard
                key={pos.instId}
                position={pos}
                onClose={undefined}
                isClosing={closingInstId === pos.instId}
                tradeSl={matchingTrade?.stopPrice ?? null}
                tradeTp1={matchingTrade?.takeProfit1 ?? null}
                tradeTp2={matchingTrade?.takeProfit2 ?? null}
                onScaleIn={undefined}
                onScaleOut={undefined}
                onUpdateSlTp={async (slPrice, tp1Price, tp2Price) => {
                  const fresh = useTradesStore
                    .getState()
                    .trades.filter(
                      (tr) =>
                        tr.pair === pos.pair &&
                        tr.direction === pos.direction &&
                        tr.status === "open",
                    )
                    .sort((a, b) => b.openedAt - a.openedAt)[0];
                  if (fresh) {
                    updateTradeSlTp(fresh.id, slPrice, tp1Price, tp2Price);
                  }
                }}
              />
            );
          })}
        </>
      )}

      <TradeTimelineCard trades={trades} limit={10} />
    </div>
  );
}
