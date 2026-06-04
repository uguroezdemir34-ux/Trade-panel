"use client";

/**
 * LIQ FEED BADGE — OKX / Binance / Bybit liq feed bağlantı durumu.
 *
 * Her borsa için küçük bir nokta gösterir:
 *   yeşil  = connected
 *   amber  = connecting (pulse)
 *   kırmızı = disconnected
 */

import { useLiqFeedStore } from "@/lib/store/liqFeedStore";
import { useHydrated } from "@/lib/store/hydration";

const EXCHANGES = [
  { key: "okx",     label: "OKX" },
  { key: "binance", label: "BIN" },
  { key: "bybit",   label: "BBT" },
] as const;

export function LiqFeedBadge(): React.ReactElement | null {
  const hydrated = useHydrated();
  const connections = useLiqFeedStore((s) => s.connections);

  if (!hydrated) return null;

  return (
    <div
      className="flex items-center gap-1 rounded px-2 py-0.5 bg-surface-s1"
      title="Liq feed: OKX / Binance / Bybit"
    >
      {EXCHANGES.map(({ key, label }) => {
        const status = connections[key];
        const dot =
          status === "connected"
            ? "bg-signal-up"
            : status === "connecting"
            ? "bg-warning animate-pulse"
            : "bg-signal-down";
        return (
          <span
            key={key}
            className="flex items-center gap-0.5"
            title={`${label}: ${status}`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
            <span className="font-mono text-[9px] text-text-t4 tracking-wider whitespace-nowrap">{label}</span>
          </span>
        );
      })}
    </div>
  );
}
