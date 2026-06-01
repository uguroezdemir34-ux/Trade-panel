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
import { getOkxAdapter } from "@/lib/exchange/okx-adapter";
import { useT } from "@/lib/i18n/context";
import type { Position } from "@/lib/okx/positions";

export default function PozisyonPage() {
  const t = useT();
  const positions = usePositionStore((s) => s.positions);
  const closingInstId = usePositionStore((s) => s.closingInstId);
  const setClosingInstId = usePositionStore((s) => s.setClosingInstId);
  const removePosition = usePositionStore((s) => s.removePosition);
  const trades = useTradesStore((s) => s.trades);
  const demoMode = useSettingsStore((s) => s.demoMode);

  const [confirmPosition, setConfirmPosition] = useState<Position | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  async function handleClose(pos: Position) {
    setCloseError(null);
    setClosingInstId(pos.instId);
    try {
      const adapter = getOkxAdapter(demoMode);
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
          {positions.map((pos) => (
            <PositionCard
              key={pos.instId}
              position={pos}
              onClose={() => setConfirmPosition(pos)}
              isClosing={closingInstId === pos.instId}
            />
          ))}
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
