"use client";

import { useT } from "@/lib/i18n/context";
import { useAccountStore } from "@/lib/store/accountStore";
import type { DrawdownTier } from "@/lib/store/accountStore";

interface TierRow {
  tier: DrawdownTier;
  thresholdKey: string;
  actionKey: string;
  multiplier: string;
  border: string;
  text: string;
  bg: string;
}

const TIER_ROWS: TierRow[] = [
  {
    tier: "normal",
    thresholdKey: "risk.protocol.normalThreshold",
    actionKey: "risk.protocol.normalAction",
    multiplier: "1×",
    border: "border-signal-green/30",
    text: "text-signal-green",
    bg: "bg-soft-green/40",
  },
  {
    tier: "caution",
    thresholdKey: "risk.protocol.cautionThreshold",
    actionKey: "risk.protocol.cautionAction",
    multiplier: "½×",
    border: "border-signal-amber/30",
    text: "text-signal-amber",
    bg: "bg-soft-amber/40",
  },
  {
    tier: "restricted",
    thresholdKey: "risk.protocol.restrictedThreshold",
    actionKey: "risk.protocol.restrictedAction",
    multiplier: "¼×",
    border: "border-signal-amber/50",
    text: "text-signal-amber",
    bg: "bg-soft-amber/60",
  },
  {
    tier: "locked",
    thresholdKey: "risk.protocol.lockedThreshold",
    actionKey: "risk.protocol.lockedAction",
    multiplier: "0×",
    border: "border-signal-red/40",
    text: "text-signal-red",
    bg: "bg-soft-red/40",
  },
];

export function DrawdownProtocolCard(): React.ReactElement {
  const t = useT();
  const currentTier = useAccountStore((s) => s.drawdownProtocol.tier);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        {t("risk.protocol.title")}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="text-text-t4 border-b border-border">
              <th className="text-left py-1 pr-2">{t("risk.protocol.colTier")}</th>
              <th className="text-right py-1 px-2">{t("risk.protocol.colThreshold")}</th>
              <th className="text-right py-1 px-2">{t("risk.protocol.colSize")}</th>
              <th className="text-right py-1 pl-2">{t("risk.protocol.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {TIER_ROWS.map((row) => {
              const isActive = row.tier === currentTier;
              return (
                <tr
                  key={row.tier}
                  className={`border-b border-border/30 transition-colors ${isActive ? `${row.bg} rounded` : ""}`}
                >
                  <td className={`py-1.5 pr-2 font-semibold ${isActive ? row.text : "text-text-t3"}`}>
                    {isActive && <span className="mr-1">▶</span>}
                    {t(`risk.drawdownTiers.${row.tier}`)}
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${isActive ? row.text : "text-text-t4"}`}>
                    {t(row.thresholdKey)}
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums font-bold ${isActive ? row.text : "text-text-t3"}`}>
                    {row.multiplier}
                  </td>
                  <td className={`py-1.5 pl-2 text-right ${isActive ? row.text : "text-text-t4"}`}>
                    {t(row.actionKey)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
