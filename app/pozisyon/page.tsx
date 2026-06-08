"use client";

import { useState } from "react";
import { usePositionStore } from "@/lib/store/positionStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { PositionCard } from "@/components/pozisyon/PositionCard";
import { PositionEmptyState } from "@/components/pozisyon/PositionEmptyState";
import { TradeTimelineCard } from "@/components/pozisyon/TradeTimelineCard";
import { CloseConfirmModal } from "@/components/pozisyon/CloseConfirmModal";
import { PortfolioSummaryBanner } from "@/components/pozisyon/PortfolioSummaryBanner";
import { getAdapter } from "@/lib/exchange";
import { useT } from "@/lib/i18n/context";
import type { Position } from "@/lib/okx/positions";

export default function PozisyonPage() {
  const t = useT();
  const positions = usePositionStore((s) => s.positions);
  const closingInstId = usePositionStore((s) => s.closingInstId);
  const setClosingInstId = usePositionStore((s) => s.setClosingInstId);
  const removePosition = usePositionStore((s) => s.removePosition);
  const trades = useTradesStore((s) => s.trades);
  const updateTradeSlTp = useTradesStore((s) => s.updateTradeSlTp);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const openTrades = trades.filter((t) => t.status === "open");

  const [confirmPosition, setConfirmPosition] = useState<Position | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  async function handleClose(pos: Position) {
    setCloseError(null);
    setClosingInstId(pos.instId);
    try {
      const adapter = getAdapter(demoMode);
      const result = await adapter.closePosition({
        instId: pos.instId,
        mgnMode: pos.mgnMode,
        posSide: pos.direction === "LONG" ? "long" : "short",
      });
      if (result.ok) {
        removePosition(pos.instId);
        setConfirmPosition(null);
      } else {
        setCloseError(result.errorMessage ?? t("app.closeFailed"));
      }
    } catch (e) {
      setCloseError(e instanceof Error ? e.message : t("karar.unknownError"));
    } finally {
      setClosingInstId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {positions.length === 0 ? (
        <PositionEmptyState />
      ) : (
        <>
          {positions.length > 1 && (
            <PortfolioSummaryBanner positions={positions} />
          )}
          {positions.map((pos) => {
            // Find most-recent open trade matching this position for Layer 2 sync
            const matchingTrade = openTrades
              .filter((t) => t.pair === pos.pair && t.direction === pos.direction)
              .sort((a, b) => b.openedAt - a.openedAt)[0];

            return (
              <PositionCard
                key={pos.instId}
                position={pos}
                onClose={() => setConfirmPosition(pos)}
                isClosing={closingInstId === pos.instId}
                tradeSl={matchingTrade?.stopPrice ?? null}
                tradeTp1={matchingTrade?.takeProfit1 ?? null}
                tradeTp2={matchingTrade?.takeProfit2 ?? null}
                onScaleIn={async (qty) => {
                  const adapter = getAdapter(demoMode);
                  const res = await adapter.openPosition({
                    pair: pos.pair,
                    direction: pos.direction,
                    qty,
                    leverage: pos.leverage,
                    marginMode: pos.mgnMode,
                  });
                  if (!res.ok) throw new Error(res.errorMessage ?? t("app.closeFailed"));
                }}
                onScaleOut={async (qty) => {
                  const adapter = getAdapter(demoMode);
                  const res = await adapter.partialClosePosition({
                    instId: pos.instId,
                    mgnMode: pos.mgnMode,
                    direction: pos.direction,
                    qty,
                  });
                  if (!res.ok) throw new Error(res.errorMessage ?? t("app.closeFailed"));
                }}
                onUpdateSlTp={async (slPrice, tp1Price, tp2Price) => {
                  // Layer 1: exchange algo orders
                  const adapter = getAdapter(demoMode);
                  const res = await adapter.updateSlTp({
                    instId: pos.instId,
                    direction: pos.direction,
                    mgnMode: pos.mgnMode,
                    qty: pos.size,
                    slPrice: slPrice ?? undefined,
                    tp1Price: tp1Price ?? undefined,
                    tp2Price: tp2Price ?? undefined,
                  });
                  if (!res.ok) throw new Error(res.errorMessage ?? t("app.closeFailed"));
                  // Layer 2: tradesStore sync — re-lookup after await to avoid stale closure
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

      {closeError && (
        <div className="bg-soft-red text-signal-red rounded-lg p-3 font-mono text-xs">
          {closeError}
        </div>
      )}

      <TradeTimelineCard trades={trades} limit={10} />

      {confirmPosition && (
        <CloseConfirmModal
          position={confirmPosition}
          onClose={() => setConfirmPosition(null)}
          onConfirm={() => handleClose(confirmPosition)}
        />
      )}
    </div>
  );
}
