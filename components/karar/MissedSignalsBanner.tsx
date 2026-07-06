"use client";

import { useEffect, useState } from "react";
import { useGoSignalLogStore } from "@/lib/store/goSignalLogStore";
import { useMarketStore } from "@/lib/store/marketStore";
import type { Pair } from "@/lib/constants/pairs";

const LS_KEY = "qx_last_seen_ts";
const SS_KEY = "qx_missed_banner_shown";

interface BannerData {
  count: number;
  topPair: Pair;
  chg: number;
}

function computeBanner(lastSeenTs: number): BannerData | null {
  const entries = useGoSignalLogStore.getState().entries;
  const prices = useMarketStore.getState().prices;

  const missed = entries.filter((e) => e.ts > lastSeenTs);
  if (missed.length === 0) return null;

  // Find pair with highest |chg24h| among missed pairs
  const missedPairs: Pair[] = [...new Set<Pair>(missed.map((e) => e.pair))];
  let topPair: Pair = missedPairs[0] as Pair;
  let topAbsChg = 0;

  for (const pair of missedPairs) {
    const tick = prices[pair];
    if (!tick) continue;
    const abs = Math.abs(tick.chg);
    if (abs > topAbsChg) {
      topAbsChg = abs;
      topPair = pair as Pair;
    }
  }

  const chg = prices[topPair]?.chg ?? 0;
  return { count: missed.length, topPair, chg };
}

export function MissedSignalsBanner(): React.ReactElement | null {
  const [banner, setBanner] = useState<BannerData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only show once per tab session
    if (sessionStorage.getItem(SS_KEY)) return;

    const rawTs = localStorage.getItem(LS_KEY);
    const lastSeenTs = rawTs ? parseInt(rawTs, 10) : 0;

    // Update lastSeenTs AFTER reading so next open sees current time
    localStorage.setItem(LS_KEY, String(Date.now()));
    sessionStorage.setItem(SS_KEY, "1");

    if (!lastSeenTs) return; // First visit — nothing to compare

    // Short delay so stores have time to hydrate from localStorage
    const tid = setTimeout(() => {
      const data = computeBanner(lastSeenTs);
      setBanner(data);
    }, 600);

    return () => clearTimeout(tid);
  }, []);

  if (!banner) return null;

  const sign = banner.chg >= 0 ? "+" : "";
  const chgColor = banner.chg >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-mono">
      <span className="text-amber-300">
        ⚡ Dışarıdayken:{" "}
        <span className="font-bold text-white">{banner.count} GO sinyali</span>
        {" · "}
        <span className="font-bold text-white">{banner.topPair}</span>{" "}
        <span className={chgColor}>
          %{sign}{banner.chg.toFixed(1)}
        </span>{" "}
        <span className="text-text-t4">(24s)</span>
      </span>
      <button
        onClick={() => setBanner(null)}
        className="ml-3 text-text-t4 hover:text-text-t2 transition-colors leading-none"
        aria-label="Kapat"
      >
        ✕
      </button>
    </div>
  );
}
