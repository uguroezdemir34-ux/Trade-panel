"use client";

/**
 * QUICK ALARM — Inline alarm setter on the karar/decision page.
 *
 * Shows a collapse-toggle bell button. Expanded: price input (pre-filled
 * with live price) + above/below toggle + optional label + Add button.
 */

import { useState, useEffect } from "react";
import { usePriceAlarmStore } from "@/lib/store/priceAlarmStore";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  pair: Pair;
  livePrice: number | null;
  direction: "LONG" | "SHORT" | "NEUTRAL";
}

export function QuickAlarm({ pair, livePrice, direction }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<"above" | "below">(
    direction === "SHORT" ? "below" : "above",
  );
  const [label, setLabel] = useState("");
  const [flash, setFlash] = useState(false);

  const alarms = usePriceAlarmStore((s) => s.alarms);
  const addAlarm = usePriceAlarmStore((s) => s.addAlarm);

  const pairAlarms = alarms.filter((a) => a.pair === pair && a.status === "active");
  const maxReached = alarms.filter((a) => a.status === "active").length >= 10;

  // Pre-fill price when panel opens or live price changes
  useEffect(() => {
    if (open && livePrice && !price) {
      setPrice(livePrice.toFixed(livePrice >= 1000 ? 1 : livePrice >= 1 ? 4 : 8));
    }
  }, [open, livePrice, price]);

  // Update condition when direction changes
  useEffect(() => {
    setCondition(direction === "SHORT" ? "below" : "above");
  }, [direction]);

  function handleAdd() {
    const priceN = parseFloat(price);
    if (!priceN || priceN <= 0 || maxReached) return;
    addAlarm({ pair, targetPrice: priceN, condition, label: label.trim() || undefined });
    setPrice("");
    setLabel("");
    setOpen(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-2xs transition-colors ${
            open
              ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
              : flash
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-border text-text-t4 hover:text-text-t3"
          }`}
        >
          <span>🔔</span>
          <span>
            {flash
              ? "✓ Eklendi"
              : open
              ? "İptal"
              : pairAlarms.length > 0
              ? `Alarm (${pairAlarms.length})`
              : "Alarm Ekle"}
          </span>
        </button>

        {/* Existing alarm pills */}
        {!open && pairAlarms.slice(0, 3).map((a) => (
          <span key={a.id} className="font-mono text-2xs text-amber-400/70 tabular-nums">
            {a.condition === "above" ? "▲" : "▼"}{a.targetPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}
          </span>
        ))}
      </div>

      {/* Inline form */}
      {open && (
        <div className="border-border bg-bg-card rounded-lg border p-3 flex flex-col gap-2.5">
          {maxReached && (
            <p className="text-amber-400 font-mono text-2xs">⚠ Maks. 10 aktif alarm</p>
          )}

          <div className="flex items-center gap-2">
            {/* Condition toggle */}
            <div className="flex gap-1">
              {(["above", "below"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={`font-mono text-2xs px-2 py-0.5 rounded border transition-colors ${
                    condition === c
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                      : "border-border text-text-t4 hover:text-text-t2"
                  }`}
                >
                  {c === "above" ? "▲ Üstünde" : "▼ Altında"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Price input */}
            <input
              type="number"
              min={0}
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Hedef fiyat"
              className="flex-1 bg-bg-page border border-border rounded px-2 py-1 font-mono text-xs text-text-t1 tabular-nums focus:outline-none focus:border-text-t3"
            />
            {livePrice && (
              <button
                onClick={() =>
                  setPrice(livePrice.toFixed(livePrice >= 1000 ? 1 : livePrice >= 1 ? 4 : 8))
                }
                className="font-mono text-2xs text-text-t4 border border-border rounded px-1.5 py-1 hover:text-text-t2 shrink-0"
              >
                Şu an
              </button>
            )}
          </div>

          {/* Label */}
          <input
            type="text"
            maxLength={40}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etiket (isteğe bağlı)"
            className="bg-bg-page border border-border rounded px-2 py-1 font-mono text-xs text-text-t1 focus:outline-none focus:border-text-t3"
          />

          <button
            onClick={handleAdd}
            disabled={!price || maxReached}
            className="border border-amber-400/40 bg-amber-400/10 text-amber-300 font-mono text-xs font-bold px-3 py-1.5 rounded hover:bg-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ▶ Alarm Ekle
          </button>
        </div>
      )}
    </div>
  );
}
