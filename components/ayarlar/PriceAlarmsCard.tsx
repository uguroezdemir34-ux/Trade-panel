"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/context";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";

export function PriceAlarmsCard(): React.ReactElement {
  const t = useT();
  const alarms = usePriceAlarmStore((s) => s.alarms);
  const addAlarm = usePriceAlarmStore((s) => s.addAlarm);
  const removeAlarm = usePriceAlarmStore((s) => s.removeAlarm);
  const clearTriggered = usePriceAlarmStore((s) => s.clearTriggered);

  const [pair, setPair] = useState<Pair>("BTC");
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [label, setLabel] = useState("");

  const activeCount = alarms.filter((a) => a.status === "active").length;
  const hasTriggered = alarms.some((a) => a.status === "triggered");

  function handleAdd() {
    const num = parseFloat(price);
    if (!num || num <= 0) return;
    addAlarm({ pair, targetPrice: num, condition, label: label.trim() || undefined });
    setPrice("");
    setLabel("");
  }

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-text-t1 text-sm font-medium">
            🔔 {t("settings.priceAlarms.title")}
          </h3>
          <p className="text-text-t3 mt-1 text-xs leading-relaxed">
            {t("settings.priceAlarms.description")}
          </p>
        </div>
        {hasTriggered && (
          <button
            onClick={clearTriggered}
            className="text-text-t4 font-mono text-2xs border border-border rounded px-2 py-1 hover:text-text-t2 transition-colors shrink-0"
          >
            {t("settings.priceAlarms.clearTriggered")}
          </button>
        )}
      </div>

      {/* Add form */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {/* Pair selector */}
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value as Pair)}
            className="bg-bg border border-border text-text-t1 font-mono text-xs rounded px-2 py-1.5 flex-shrink-0"
          >
            {PAIRS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Condition toggle */}
          <div className="flex rounded border border-border overflow-hidden flex-shrink-0">
            {(["above", "below"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCondition(c)}
                className={[
                  "px-2.5 py-1.5 font-mono text-xs transition-colors",
                  condition === c
                    ? c === "above"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                    : "text-text-t4 hover:text-text-t2",
                ].join(" ")}
              >
                {c === "above" ? "▲" : "▼"} {t(`settings.priceAlarms.${c}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Price input */}
          <input
            type="number"
            min="0"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("settings.priceAlarms.pricePlaceholder")}
            className="bg-bg border border-border text-text-t1 font-mono text-xs rounded px-2 py-1.5 flex-1 min-w-0"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          {/* Label input */}
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("settings.priceAlarms.labelPlaceholder")}
            className="bg-bg border border-border text-text-t1 font-mono text-xs rounded px-2 py-1.5 flex-1 min-w-0"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={activeCount >= 10 || !price}
            className="bg-brand text-white font-mono text-xs rounded px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
          >
            {t("settings.priceAlarms.addButton")}
          </button>
        </div>

        {activeCount >= 10 && (
          <p className="text-amber-400 font-mono text-xs">
            ⚠ {t("settings.priceAlarms.maxReached")}
          </p>
        )}
      </div>

      {/* Alarm list */}
      {alarms.length === 0 ? (
        <p className="text-text-t4 font-mono text-xs">
          {t("settings.priceAlarms.noAlarms")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {alarms.map((alarm) => (
            <div
              key={alarm.id}
              className={[
                "flex items-center justify-between gap-2 rounded border px-2 py-1.5",
                alarm.status === "triggered"
                  ? "border-border/30 opacity-50"
                  : "border-border",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={[
                    "font-mono text-2xs font-semibold shrink-0",
                    alarm.condition === "above" ? "text-green-400" : "text-red-400",
                  ].join(" ")}
                >
                  {alarm.condition === "above" ? "▲" : "▼"}
                </span>
                <span className="text-text-t2 font-mono text-xs font-semibold shrink-0">
                  {alarm.pair}
                </span>
                <span className="text-text-t3 font-mono text-xs tabular-nums shrink-0">
                  {alarm.targetPrice.toLocaleString()}
                </span>
                {alarm.label && (
                  <span className="text-text-t4 font-mono text-2xs truncate">
                    {alarm.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={[
                    "font-mono text-2xs rounded px-1.5 py-0.5",
                    alarm.status === "active"
                      ? "bg-brand/20 text-brand"
                      : "bg-border/30 text-text-t4",
                  ].join(" ")}
                >
                  {alarm.status === "active"
                    ? t("settings.priceAlarms.activeLabel")
                    : t("settings.priceAlarms.triggeredLabel")}
                </span>
                <button
                  onClick={() => removeAlarm(alarm.id)}
                  className="text-text-t4 hover:text-red-400 font-mono text-sm leading-none transition-colors"
                  aria-label="Remove alarm"
                >
                  {t("settings.priceAlarms.remove")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
