"use client";

import { useAccountStore } from "@/lib/store/accountStore";

const TIER_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  normal:     { label: "NORMAL",     color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20"  },
  caution:    { label: "CAUTION",    color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  restricted: { label: "RESTRICTED", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  locked:     { label: "LOCKED",     color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20"       },
};

export function AccountSummaryBar(): React.ReactElement {
  const balanceTotal  = useAccountStore((s) => s.balanceTotal);
  const balanceFree   = useAccountStore((s) => s.balanceFree);
  const dailyPnlPct   = useAccountStore((s) => s.dailyPnlPct);
  const weeklyPnlPct  = useAccountStore((s) => s.weeklyPnlPct);
  const protocol      = useAccountStore((s) => s.drawdownProtocol);

  const tier   = TIER_STYLE[protocol.tier] ?? TIER_STYLE.normal;
  const usedMargin   = balanceTotal - balanceFree;
  const usedMarginPct = balanceTotal > 0 ? (usedMargin / balanceTotal) * 100 : 0;
  const dailyColor = dailyPnlPct > 0 ? "text-green-400" : dailyPnlPct < 0 ? "text-red-400" : "text-text-t3";
  const weeklyColor = weeklyPnlPct > 0 ? "text-green-400" : weeklyPnlPct < 0 ? "text-red-400" : "text-text-t3";

  return (
    <div className="rounded-lg border border-border bg-bg-card px-4 py-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Bakiye */}
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-widest uppercase">Bakiye</div>
          <div translate="no" className="font-mono text-sm font-bold tabular-nums text-text-t1 mt-0.5">
            ${balanceTotal > 0 ? balanceTotal.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
          </div>
        </div>

        {/* Margin kullanımı */}
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-widest uppercase">Margin</div>
          <div translate="no" className="font-mono text-sm font-bold tabular-nums text-text-t1 mt-0.5">
            {usedMarginPct > 0 ? `${usedMarginPct.toFixed(1)}%` : "—"}
          </div>
          <div className="mt-1 h-1 rounded-full bg-border overflow-hidden w-20">
            <div
              className={`h-full rounded-full transition-all ${usedMarginPct > 70 ? "bg-red-400" : usedMarginPct > 40 ? "bg-yellow-400" : "bg-green-400"}`}
              style={{ width: `${Math.min(100, usedMarginPct).toFixed(1)}%` }}
            />
          </div>
        </div>

        {/* Günlük / Haftalık P&L */}
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-widest uppercase">Günlük / Haftalık</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span translate="no" className={`font-mono text-sm font-bold tabular-nums ${dailyColor}`}>
              {dailyPnlPct !== 0 ? `${dailyPnlPct > 0 ? "+" : ""}${dailyPnlPct.toFixed(2)}%` : "—"}
            </span>
            <span translate="no" className={`font-mono text-xs tabular-nums ${weeklyColor}`}>
              {weeklyPnlPct !== 0 ? `${weeklyPnlPct > 0 ? "+" : ""}${weeklyPnlPct.toFixed(2)}%W` : ""}
            </span>
          </div>
        </div>

        {/* Drawdown tier */}
        <div>
          <div className="font-mono text-2xs text-text-t4 tracking-widest uppercase">Protokol</div>
          <span className={`inline-block mt-0.5 rounded border px-2 py-0.5 font-mono text-2xs font-bold tracking-widest ${tier.color} ${tier.bg}`}>
            {tier.label}
          </span>
          {protocol.tier !== "normal" && (
            <div className="font-mono text-2xs text-text-t4 mt-0.5">×{protocol.multiplier.toFixed(2)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
