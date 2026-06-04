"use client";

import { useState, useCallback, useRef } from "react";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { fetchOkxClosedOrders } from "@/lib/okx/fills";
import { reconcile, type ReconcileResult } from "@/lib/reconcile/reconciler";

export type ReconcileStatus = "idle" | "loading" | "done" | "error";

export interface TradeReconciliation {
  status: ReconcileStatus;
  result: ReconcileResult | null;
  errorMsg: string | null;
  syncNow: () => Promise<void>;
  applyUpdates: () => void;
}

export function useTradeReconciliation(): TradeReconciliation {
  const [status, setStatus] = useState<ReconcileStatus>("idle");
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tradesRef = useRef(useTradesStore.getState().trades);
  const patchFromReconcile = useTradesStore((s) => s.patchFromReconcile);
  const demoMode = useSettingsStore((s) => s.demoMode ?? false);

  const syncNow = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      // Always read fresh snapshot from store
      const trades = useTradesStore.getState().trades;
      tradesRef.current = trades;

      const okxOrders = await fetchOkxClosedOrders(demoMode, 100);
      const rec = reconcile(trades, okxOrders);
      setResult(rec);
      setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [demoMode]);

  const applyUpdates = useCallback(() => {
    if (!result) return;
    const patches = result.matched.filter((m) => m.needsUpdate);
    patchFromReconcile(patches);
  }, [result, patchFromReconcile]);

  return { status, result, errorMsg, syncNow, applyUpdates };
}
