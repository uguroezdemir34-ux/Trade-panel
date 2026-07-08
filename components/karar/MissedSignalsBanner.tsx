"use client";

import { useEffect, useState } from "react";
import { useGoSignalLogStore } from "@/lib/store/goSignalLogStore";
import type { Pair } from "@/lib/constants/pairs";

const LS_KEY = "qx_last_seen_ts";
const SS_KEY = "qx_missed_banner_shown";

interface BannerData {
  count: number;
  topPair: Pair;
  signalTs: number;
  signalPrice: number;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function fmtPrice(p: number): string {
  if (p >= 10000) return `$${p.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  if (p >= 100)   return `$${p.toFixed(2)}`;
  if (p >= 1)     return `$${p.toFixed(3)}`;
  if (p >= 0.01)  return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function computeBanner(lastSeenTs: number): BannerData | null {
  const entries = useGoSignalLogStore.getState().entries;

  const missed = entries.filter((e) => e.ts > lastSeenTs);
  if (missed.length === 0) return null;

  // Most recent missed signal shown as "top"
  const top = missed.reduce((a, b) => (b.ts > a.ts ? b : a));

  return {
    count: missed.length,
    topPair: top.pair,
    signalTs: top.ts,
    signalPrice: top.triggerPriceAtGo,
  };
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

  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-mono">
      <span className="text-amber-600 dark:text-amber-300">
        ⚡ Dışarıdayken:{" "}
        <span className="font-bold text-gray-900 dark:text-white">{banner.count} GO sinyali</span>
        {" · "}
        <span className="font-bold text-gray-900 dark:text-white">{banner.topPair}</span>{" "}
        <span className="text-gray-700 dark:text-text-t2">{fmtPrice(banner.signalPrice)}</span>
        {" · "}
        <span className="text-gray-500 dark:text-text-t4">{fmtTime(banner.signalTs)}</span>
      </span>
      <button
        onClick={() => setBanner(null)}
        className="ml-3 text-gray-400 dark:text-text-t4 hover:text-gray-600 dark:hover:text-text-t2 transition-colors leading-none"
        aria-label="Kapat"
      >
        ✕
      </button>
    </div>
  );
}
