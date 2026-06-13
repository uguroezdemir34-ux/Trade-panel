"use client";

import { useState, useEffect } from "react";
import { useT, useLocale } from "@/lib/i18n/context";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { formatPrice } from "@/lib/i18n/format";
import type { Pair } from "@/lib/constants/pairs";

interface Props {
  pair: Pair;
}

export function QuickTradePanel({ pair }: Props) {
  const t = useT();
  const locale = useLocale();
  const result = useScoreStore((s) => s.results[pair]);
  const livePrice = useMarketStore((s) => s.prices[pair]?.last ?? null);

  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [notionalUsd, setNotionalUsd] = useState("100");
  const [leverage, setLeverage] = useState("5");
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");

  useEffect(() => {
    if (result?.direction === "LONG" || result?.direction === "SHORT") {
      setDirection(result.direction);
    }
  }, [pair, result?.direction]);

  const isLong = direction === "LONG";
  const approxQty = livePrice && parseFloat(notionalUsd) > 0
    ? (parseFloat(notionalUsd) / livePrice).toFixed(4)
    : "—";

  return (
    <div className="rounded-lg border border-border bg-bg-card p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-2xs text-text-t3 tracking-widest uppercase">
          {t("grafik.quickTrade")}
        </span>
        {result && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-2xs font-bold ${
              result.verdict === "go"
                ? "bg-green-500/15 text-green-400"
                : result.verdict === "wait"
                ? "bg-yellow-500/15 text-yellow-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {result.score} {result.verdict.toUpperCase()}
          </span>
        )}
      </div>

      {/* Direction buttons */}
      <div className="mb-3 flex gap-1">
        <button
          onClick={() => setDirection("LONG")}
          className={`flex-1 rounded border py-1.5 font-mono text-2xs font-bold tracking-widest transition-colors ${
            isLong
              ? "border-signal-green/50 bg-signal-green/15 text-signal-green"
              : "border-border text-text-t4 hover:text-text-t2"
          }`}
        >
          ▲ LONG
        </button>
        <button
          onClick={() => setDirection("SHORT")}
          className={`flex-1 rounded border py-1.5 font-mono text-2xs font-bold tracking-widest transition-colors ${
            !isLong
              ? "border-signal-red/50 bg-signal-red/15 text-signal-red"
              : "border-border text-text-t4 hover:text-text-t2"
          }`}
        >
          ▼ SHORT
        </button>
      </div>

      {/* Notional + Leverage inputs */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 font-mono text-2xs text-text-t4">USDT</div>
          <input
            type="number"
            value={notionalUsd}
            onChange={(e) => setNotionalUsd(e.target.value)}
            className="w-full rounded border border-border bg-surface-s1 px-2 py-1 font-mono text-xs text-text-t1 focus:border-brand/50 outline-none"
          />
        </div>
        <div>
          <div className="mb-1 font-mono text-2xs text-text-t4">LEV</div>
          <input
            type="number"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="w-full rounded border border-border bg-surface-s1 px-2 py-1 font-mono text-xs text-text-t1 focus:border-brand/50 outline-none"
          />
        </div>
      </div>

      {/* Margin mode */}
      <div className="mb-3 flex gap-1">
        {(["cross", "isolated"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMarginMode(m)}
            className={`flex-1 rounded border py-0.5 font-mono text-2xs tracking-widest uppercase transition-colors ${
              marginMode === m
                ? "border-brand/50 bg-brand/10 text-brand"
                : "border-border text-text-t4 hover:text-text-t2"
            }`}
          >
            {m === "cross" ? t("confirm.cross") : t("confirm.isolated")}
          </button>
        ))}
      </div>

      {/* Price info */}
      {livePrice && (
        <div className="mb-3 font-mono text-2xs text-text-t4 tabular-nums">
          @ {formatPrice(livePrice, locale)} · ~{approxQty} {pair}
        </div>
      )}

      {/* Sinyal modu */}
      <div className="rounded border border-amber-500/30 bg-amber-500/10 py-2 text-center font-mono text-2xs text-amber-400">
        ⚙ Sinyal modu — emir gönderme devre dışı
      </div>
    </div>
  );
}
