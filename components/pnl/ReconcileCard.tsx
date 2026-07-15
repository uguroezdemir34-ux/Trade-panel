"use client";

import { useMemo, useState } from "react";
import { useTradeReconciliation } from "@/lib/hooks/useTradeReconciliation";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useT } from "@/lib/i18n/context";
import type { ReconcileOrphan } from "@/lib/reconcile/reconciler";

function fmtPnl(usd: number): string {
  const sign = usd >= 0 ? "+" : "";
  return `${sign}$${Math.abs(usd).toFixed(2)}`;
}

function fmtDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ReconcileCard() {
  const t = useT();
  const { status, result, errorMsg, syncNow, applyUpdates } = useTradeReconciliation();
  const importOrphanTrade = useTradesStore((s) => s.importOrphanTrade);
  const importOrphanTrades = useTradesStore((s) => s.importOrphanTrades);
  // Zustand'ın kendi trades[]'i "zaten içe aktarıldı mı" için tek gerçek kaynak —
  // orderId eşleşmesi kalıcı (sync/reload sonrası da doğru), ayrı bir local
  // Set tutmaya gerek yok. Set hesaplaması useMemo'da — selector'da inline
  // `new Set(...)` her store bildirimi için gereksiz yeniden hesap/render'a yol açardı.
  const trades = useTradesStore((s) => s.trades);
  const importedOrderIds = useMemo(
    () => new Set(trades.map((t) => t.orderId).filter((id): id is string => id != null)),
    [trades],
  );
  const [importing, setImporting] = useState(false);

  const pendingUpdates = result?.matched.filter((m) => m.needsUpdate).length ?? 0;
  const orphanCount = result?.orphans.length ?? 0;
  const importableOrphans = (result?.orphans ?? []).filter(
    (o) => o.pair !== null && o.direction !== null && !importedOrderIds.has(o.ordId),
  );

  function handleImportOne(o: ReconcileOrphan): void {
    importOrphanTrade(o);
  }

  function handleImportAll(): void {
    if (importableOrphans.length === 0) return;
    setImporting(true);
    try {
      importOrphanTrades(importableOrphans);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-wider text-text-t1 uppercase">
            {t("reconcile.title")}
          </p>
          <p className="font-mono text-2xs text-text-t4 mt-0.5">
            {t("reconcile.subtitle")}
          </p>
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={status === "loading"}
          className="rounded px-3 py-1.5 font-mono text-xs tracking-wider border border-border
            text-text-t2 hover:text-text-t1 hover:border-brand transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "loading" ? t("reconcile.syncing") : t("reconcile.syncNow")}
        </button>
      </div>

      {/* Error */}
      {status === "error" && errorMsg && (
        <p className="font-mono text-2xs text-red-400">{errorMsg}</p>
      )}

      {/* Summary stats */}
      {result && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded bg-surface-s1 p-2 text-center">
            <p className="font-mono text-lg text-text-t1">{result.matched.length}</p>
            <p className="font-mono text-2xs text-text-t4">{t("reconcile.matched")}</p>
          </div>
          <div className="rounded bg-surface-s1 p-2 text-center">
            <p className={`font-mono text-lg ${pendingUpdates > 0 ? "text-yellow-400" : "text-text-t1"}`}>
              {pendingUpdates}
            </p>
            <p className="font-mono text-2xs text-text-t4">{t("reconcile.needsUpdate")}</p>
          </div>
          <div className="rounded bg-surface-s1 p-2 text-center">
            <p className={`font-mono text-lg ${orphanCount > 0 ? "text-orange-400" : "text-text-t1"}`}>
              {orphanCount}
            </p>
            <p className="font-mono text-2xs text-text-t4">{t("reconcile.orphans")}</p>
          </div>
        </div>
      )}

      {/* Apply button */}
      {pendingUpdates > 0 && (
        <button
          onClick={applyUpdates}
          className="w-full rounded py-2 font-mono text-xs tracking-wider
            bg-brand text-black hover:opacity-90 transition-opacity"
        >
          {t("reconcile.applyUpdates", { count: String(pendingUpdates) })}
        </button>
      )}

      {/* Matches with delta */}
      {result && result.matched.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-2xs text-text-t4 uppercase tracking-wider">
            {t("reconcile.matchedOrders")}
          </p>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
            {result.matched.map((m) => {
              const delta = m.okxPnlUsd - m.localPnlUsd;
              return (
                <div
                  key={m.tradeId}
                  className="flex items-center justify-between rounded bg-surface-s1 px-2 py-1"
                >
                  <span className="font-mono text-2xs text-text-t3 truncate max-w-[100px]">
                    {m.tradeId.slice(0, 12)}…
                  </span>
                  <span className="font-mono text-2xs text-text-t2">
                    {fmtPnl(m.okxPnlUsd)}
                  </span>
                  {Math.abs(delta) > 0.01 && (
                    <span className={`font-mono text-2xs ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                    </span>
                  )}
                  {m.needsUpdate && (
                    <span className="font-mono text-2xs text-yellow-400">↑</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Orphans */}
      {result && result.orphans.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-2xs text-text-t4 uppercase tracking-wider">
              {t("reconcile.orphanOrders")}
            </p>
            {importableOrphans.length > 0 && (
              <button
                onClick={handleImportAll}
                disabled={importing}
                className="rounded px-2 py-0.5 font-mono text-2xs tracking-wider border border-border
                  text-text-t2 hover:text-text-t1 hover:border-brand transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("reconcile.importAll", { count: String(importableOrphans.length) })}
              </button>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
            {result.orphans.map((o) => {
              const alreadyImported = importedOrderIds.has(o.ordId);
              const canImport = o.pair !== null && o.direction !== null;
              return (
                <div
                  key={o.ordId}
                  className="flex items-center justify-between gap-2 rounded bg-surface-s1 px-2 py-1"
                >
                  <span className="font-mono text-2xs text-text-t3 shrink-0">
                    {o.pair ?? "?"} {o.direction ?? "?"}
                  </span>
                  <span className="font-mono text-2xs text-text-t2 shrink-0">
                    {fmtPnl(o.pnlUsd)}
                  </span>
                  <span className="font-mono text-2xs text-text-t4 shrink-0">
                    {fmtDate(o.filledAtMs)}
                  </span>
                  <span className="ml-auto shrink-0">
                    {alreadyImported ? (
                      <span className="font-mono text-2xs text-signal-green">
                        {t("reconcile.imported")}
                      </span>
                    ) : canImport ? (
                      <button
                        onClick={() => handleImportOne(o)}
                        className="rounded px-2 py-0.5 font-mono text-2xs tracking-wider border border-border
                          text-text-t2 hover:text-text-t1 hover:border-brand transition-colors"
                      >
                        {t("reconcile.importOne")}
                      </button>
                    ) : (
                      <span className="font-mono text-2xs text-text-t4">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="font-mono text-2xs text-text-t4">
            {t("reconcile.orphanHint")}
          </p>
          {importedOrderIds.size > 0 && (
            <p className="font-mono text-2xs text-text-t4">
              {t("reconcile.importApproxNote")}
            </p>
          )}
        </div>
      )}

      {/* All clear */}
      {result && result.matched.length === 0 && result.orphans.length === 0 && (
        <p className="font-mono text-2xs text-text-t4 text-center py-2">
          {t("reconcile.allClear")}
        </p>
      )}

      {/* Last sync time */}
      {result && (
        <p className="font-mono text-2xs text-text-t4 text-right">
          {t("reconcile.lastSync")}: {fmtDate(result.syncedAt)}
        </p>
      )}
    </div>
  );
}
