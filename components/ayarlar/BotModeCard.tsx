"use client";

import { useMemo } from "react";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useTradesStore } from "@/lib/store/tradesStore";
import { useT } from "@/lib/i18n/context";

export function BotModeCard(): React.ReactElement {
  const t = useT();
  const botModeEnabled = useSettingsStore((s) => s.botModeEnabled);
  const botModeMinScore = useSettingsStore((s) => s.botModeMinScore);
  const setBotModeEnabled = useSettingsStore((s) => s.setBotModeEnabled);
  const setBotModeMinScore = useSettingsStore((s) => s.setBotModeMinScore);

  const trades = useTradesStore((s) => s.trades);
  const botTrades = useMemo(
    () =>
      trades
        .filter((tr) => tr.source === "bot")
        .sort((a, b) => b.openedAt - a.openedAt)
        .slice(0, 5),
    [trades],
  );

  return (
    <div
      className={[
        "rounded-lg border p-4 transition-colors",
        botModeEnabled
          ? "border-red-500/60 bg-red-950/20"
          : "border-border bg-bg-card",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-text-t1">
            {t("settings.botMode.title")}
          </p>
          <p className="mt-0.5 font-mono text-xs text-text-t3">
            {t("settings.botMode.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBotModeEnabled(!botModeEnabled)}
          className={[
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
            botModeEnabled ? "bg-red-500" : "bg-surface-2",
          ].join(" ")}
          aria-checked={botModeEnabled}
          role="switch"
        >
          <span
            className={[
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              botModeEnabled ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Warning banner */}
      {botModeEnabled && (
        <div className="mt-3 rounded border border-red-500/40 bg-red-950/30 p-2">
          <p className="font-mono text-xs text-red-400">
            ⚠ {t("settings.botMode.warning")}
          </p>
        </div>
      )}

      {/* Min score config */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs text-text-t2">
            {t("settings.botMode.minScore")}
          </label>
          <span className="font-mono text-sm font-semibold text-brand">
            {botModeMinScore}
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={5}
          value={botModeMinScore}
          onChange={(e) => setBotModeMinScore(Number(e.target.value))}
          className="w-full accent-brand"
        />
        <div className="flex justify-between font-mono text-xs text-text-t3">
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Status */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={[
            "h-2 w-2 rounded-full",
            botModeEnabled ? "animate-pulse bg-red-500" : "bg-surface-2",
          ].join(" ")}
        />
        <span className="font-mono text-xs text-text-t3">
          {botModeEnabled
            ? t("settings.botMode.statusActive")
            : t("settings.botMode.statusOff")}
        </span>
      </div>

      {/* Recent bot trades */}
      {botTrades.length > 0 && (
        <div className="mt-4 border-t border-border/40 pt-3">
          <p className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-2">
            Son Bot İşlemleri
          </p>
          <div className="flex flex-col gap-1.5">
            {botTrades.map((tr) => {
              const pnl = tr.exit?.pnlUsd;
              const date = new Date(tr.openedAt).toLocaleDateString("tr-TR", {
                day: "2-digit", month: "2-digit",
              });
              const time = new Date(tr.openedAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={tr.id} className="flex items-center gap-2 font-mono text-2xs">
                  <span className="text-text-t4 shrink-0">{date} {time}</span>
                  <span className="font-semibold text-text-t2 shrink-0">{tr.pair}</span>
                  <span className={`shrink-0 ${tr.direction === "LONG" ? "text-signal-green" : "text-signal-red"}`}>
                    {tr.direction === "LONG" ? "▲" : "▼"}
                  </span>
                  <span className={`ml-auto tabular-nums font-semibold ${
                    tr.status === "open"
                      ? "text-amber-400"
                      : pnl === undefined
                      ? "text-text-t4"
                      : pnl >= 0
                      ? "text-signal-green"
                      : "text-signal-red"
                  }`}>
                    {tr.status === "open"
                      ? "açık"
                      : pnl !== undefined
                      ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}$`
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
