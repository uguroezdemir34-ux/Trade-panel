"use client";

import React, { useMemo } from "react";
import { useT } from "@/lib/i18n/context";
import { useTradesStore } from "@/lib/store/tradesStore";
import { computePnlStats } from "@/lib/pnl/stats";
import type { TradeRecord } from "@/lib/pnl/types";

const OKX_URL = process.env.NEXT_PUBLIC_OKX_LEAD_URL ?? "";
const BINANCE_URL = process.env.NEXT_PUBLIC_BINANCE_LEAD_URL ?? "";

async function openUrl(url: string): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    }
  } catch {
    /* fall through to window.open */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

interface ExchangeSectionProps {
  heading: string;
  steps: string[];
  buttonLabel: string;
  url: string;
  notConfiguredLabel: string;
  accentClass: string;
  buttonClass: string;
}

function ExchangeSection({
  heading,
  steps,
  buttonLabel,
  url,
  notConfiguredLabel,
  accentClass,
  buttonClass,
}: ExchangeSectionProps) {
  const configured = url.length > 0;

  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <h3 className="font-mono text-sm font-semibold mb-3">{heading}</h3>
      <ol className="space-y-1.5 mb-4 list-decimal list-inside">
        {steps.map((step, i) => (
          <li key={i} className="font-mono text-xs text-text-t2 leading-relaxed">
            {step}
          </li>
        ))}
      </ol>
      {configured ? (
        <button
          type="button"
          onClick={() => void openUrl(url)}
          className={`w-full rounded py-2.5 font-mono text-xs font-semibold tracking-wider transition-opacity hover:opacity-80 active:scale-95 ${buttonClass}`}
        >
          {buttonLabel}
        </button>
      ) : (
        <div className="rounded border border-border py-2 text-center font-mono text-2xs text-text-t3">
          {notConfiguredLabel}
        </div>
      )}
    </div>
  );
}

function TraderProfileCard(): React.ReactElement {
  const t = useT();
  const snapshots = useTradesStore((s) => s.trades);

  const trades: TradeRecord[] = useMemo(
    () =>
      snapshots
        .filter((s) => s.status === "closed" && s.exit != null)
        .map((s) => ({
          closedAt: s.exit!.closedAt,
          openedAt: s.openedAt,
          pair: s.pair,
          direction: s.direction,
          pnlUsd: s.exit!.pnlUsd,
          pnlPct: s.exit!.pnlPct,
          score: s.entryContext.score,
          closeReason: s.exit!.reason,
          rMultiple: s.exit!.rMultiple,
        })),
    [snapshots],
  );

  const stats = useMemo(() => computePnlStats(trades), [trades]);

  const activeSinceStr = useMemo(() => {
    if (trades.length === 0) return null;
    const oldest = trades.reduce((min, tr) => Math.min(min, tr.openedAt ?? tr.closedAt), Infinity);
    if (!isFinite(oldest)) return null;
    return new Date(oldest).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }, [trades]);

  const pnlSign = stats.totalPnlUsd >= 0 ? "+" : "";
  const pnlColor = stats.totalPnlUsd > 0 ? "text-signal-green" : stats.totalPnlUsd < 0 ? "text-signal-red" : "text-text-t2";

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-xs font-semibold tracking-widest text-text-t1 uppercase">
          {t("copyTrading.profileTitle")}
        </h3>
        {activeSinceStr && (
          <span className="font-mono text-2xs text-text-t4">
            {t("copyTrading.profileActiveSince")} {activeSinceStr}
          </span>
        )}
      </div>

      {trades.length === 0 ? (
        <p className="font-mono text-2xs text-text-t4 leading-relaxed">
          {t("copyTrading.profileNoTrades")}
        </p>
      ) : (
        <>
          <div className="mb-1 font-mono text-2xs text-text-t4">
            {stats.totalTrades} {t("copyTrading.profileTrades")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ProfileStat
              label="Win Rate"
              value={stats.totalTrades > 0 ? `${(stats.winRate * 100).toFixed(0)}%` : "—"}
              color={stats.winRate >= 0.55 ? "text-signal-green" : stats.winRate >= 0.4 ? "text-signal-amber" : "text-signal-red"}
            />
            <ProfileStat
              label="Total P&L"
              value={`${pnlSign}$${stats.totalPnlUsd.toFixed(0)}`}
              color={pnlColor}
            />
            <ProfileStat
              label="Profit Factor"
              value={
                stats.profitFactor === null ? "—"
                : !isFinite(stats.profitFactor) ? "∞"
                : stats.profitFactor.toFixed(2)
              }
              color={stats.profitFactor !== null && stats.profitFactor >= 1 ? "text-signal-green" : "text-signal-red"}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ProfileStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className={`font-mono text-base font-bold tabular-nums ${color ?? "text-text-t1"}`}>
        {value}
      </div>
      <div className="font-mono text-2xs text-text-t4 mt-0.5 tracking-wider">{label}</div>
    </div>
  );
}

export function CopyTradingCard(): React.ReactElement {
  const t = useT();

  const okxSteps = [
    t("copyTrading.okxStep1"),
    t("copyTrading.okxStep2"),
    t("copyTrading.okxStep3"),
    t("copyTrading.okxStep4"),
  ];

  const binanceSteps = [
    t("copyTrading.binanceStep1"),
    t("copyTrading.binanceStep2"),
    t("copyTrading.binanceStep3"),
    t("copyTrading.binanceStep4"),
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Trader profile stats */}
      <TraderProfileCard />

      {/* Header */}
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <h2 className="font-mono text-sm font-semibold text-text-t1 mb-1">
          {t("copyTrading.title")}
        </h2>
        <p className="font-mono text-xs text-text-t2 leading-relaxed">
          {t("copyTrading.description")}
        </p>
        <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="font-mono text-2xs text-amber-400 leading-relaxed">
            {t("copyTrading.disclaimer")}
          </p>
        </div>
      </div>

      {/* OKX */}
      <ExchangeSection
        heading={t("copyTrading.okxHeading")}
        steps={okxSteps}
        buttonLabel={t("copyTrading.okxButton")}
        url={OKX_URL}
        notConfiguredLabel={t("copyTrading.notConfigured")}
        accentClass="border-blue-500/30 bg-blue-500/5"
        buttonClass="bg-blue-600 text-white"
      />

      {/* Binance */}
      <ExchangeSection
        heading={t("copyTrading.binanceHeading")}
        steps={binanceSteps}
        buttonLabel={t("copyTrading.binanceButton")}
        url={BINANCE_URL}
        notConfiguredLabel={t("copyTrading.notConfigured")}
        accentClass="border-yellow-500/30 bg-yellow-500/5"
        buttonClass="bg-yellow-500 text-black"
      />
    </div>
  );
}
