"use client";

/**
 * ALARM TOAST CONTAINER — In-app price alarm notifications.
 *
 * Watches priceAlarmStore for newly triggered alarms (status → "triggered").
 * Shows a dismissable toast for each trigger; auto-dismisses after 5s.
 * Renders as a fixed overlay below the header.
 */

import { useEffect, useRef, useState } from "react";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import type { PriceAlarm } from "@/lib/store/priceAlarmStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { useT } from "@/lib/i18n/context";

interface Toast {
  alarm: PriceAlarm;
  triggeredAt: number;
}

export function AlarmToastContainer(): React.ReactElement | null {
  const alarms = usePriceAlarmStore((s) => s.alarms);
  const prices = useMarketStore((s) => s.prices);
  const seenRef = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    for (const alarm of alarms) {
      if (alarm.status === "triggered" && !seenRef.current.has(alarm.id)) {
        seenRef.current.add(alarm.id);
        setToasts((prev) => [...prev, { alarm, triggeredAt: alarm.triggeredAt ?? Date.now() }]);
      }
    }
  }, [alarms]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.alarm.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-14 right-3 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map(({ alarm }) => {
        const currentPrice = prices[alarm.pair]?.last;
        return (
          <AlarmToast
            key={alarm.id}
            alarm={alarm}
            currentPrice={currentPrice ?? null}
            onDismiss={() => dismiss(alarm.id)}
          />
        );
      })}
    </div>
  );
}

function AlarmToast({
  alarm,
  currentPrice,
  onDismiss,
}: {
  alarm: PriceAlarm;
  currentPrice: number | null;
  onDismiss: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const id = setTimeout(onDismiss, 5000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      className="pointer-events-auto rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-4 fade-in duration-200"
      onClick={onDismiss}
      role="alert"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 font-mono text-xs">🔔</span>
            <span className="text-amber-300 font-mono text-xs font-bold tracking-widest">
              {alarm.pair}/USDT
            </span>
            <span className="text-amber-400/70 font-mono text-2xs">
              {alarm.condition === "above" ? `▲ ${t("karar.alarmToastAbove")}` : `▼ ${t("karar.alarmToastBelow")}`}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-text-t4 font-mono text-2xs">{t("karar.alarmToastTarget")}</span>
            <span className="text-amber-300 font-mono text-xs tabular-nums font-semibold">
              {alarm.targetPrice.toLocaleString("en-US", { maximumFractionDigits: 6 })}
            </span>
            {currentPrice !== null && (
              <>
                <span className="text-text-t4 font-mono text-2xs">{t("karar.alarmToastNow")}</span>
                <span className="text-text-t3 font-mono text-xs tabular-nums">
                  {currentPrice.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                </span>
              </>
            )}
          </div>
          {alarm.label && (
            <span className="text-text-t4 font-mono text-2xs">{alarm.label}</span>
          )}
        </div>
        <button
          className="text-text-t4 hover:text-text-t2 font-mono text-xs shrink-0 mt-0.5"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
