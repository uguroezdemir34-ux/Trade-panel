"use client";

import { useState, useMemo } from "react";
import { useAccountStore } from "@/lib/store/accountStore";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function PositionSizeCalc(): React.ReactElement {
  const balance = useAccountStore((s) => s.balanceTotal);
  const defaultLev = useSettingsStore((s) => s.defaultLeverage);
  const defaultRiskPct = useSettingsStore((s) => s.defaultRiskPct);
  const setDefaultRiskPct = useSettingsStore((s) => s.setDefaultRiskPct);

  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [riskPct, setRiskPct] = useState(defaultRiskPct);
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [lev, setLev] = useState<number>(defaultLev);

  const calc = useMemo(() => {
    const entryN = parseFloat(entry);
    const slN = parseFloat(sl);
    if (!entryN || !slN || entryN <= 0 || slN <= 0) return null;

    const slValid = direction === "LONG" ? slN < entryN : slN > entryN;
    if (!slValid) return { invalid: true as const };

    const slDistFrac = Math.abs(entryN - slN) / entryN;
    if (slDistFrac <= 0) return null;

    const riskUsd = balance * (riskPct / 100);
    const notional = riskUsd / slDistFrac;
    const margin = notional / lev;
    const coins = notional / entryN;

    return {
      invalid: false as const,
      riskUsd,
      slDistPct: slDistFrac * 100,
      notional,
      margin,
      coins,
    };
  }, [entry, sl, riskPct, lev, balance, direction]);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase mb-3">
        ⚖️ Position Size Calculator
      </h3>

      {/* Direction + Risk % row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex gap-1">
          {(["LONG", "SHORT"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`font-mono text-2xs font-bold px-2 py-1 rounded border transition-colors ${
                direction === d
                  ? d === "LONG"
                    ? "border-green-500/50 bg-green-500/10 text-green-400"
                    : "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-border text-text-t4 hover:text-text-t2"
              }`}
            >
              {d === "LONG" ? "▲ LONG" : "▼ SHORT"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-text-t4 font-mono text-2xs">Risk</span>
          <input
            type="number"
            min={0.1}
            max={5}
            step={0.1}
            value={riskPct}
            onChange={(e) => {
              const v = Math.max(0.1, Math.min(5, parseFloat(e.target.value) || 1));
              setRiskPct(v);
              setDefaultRiskPct(v);
            }}
            className="w-14 bg-bg-page border border-border rounded px-1.5 py-0.5 font-mono text-xs text-text-t1 text-right tabular-nums focus:outline-none focus:border-text-t3"
          />
          <span className="text-text-t4 font-mono text-2xs">%</span>
        </div>
      </div>

      {/* Price inputs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <LabeledInput
          label="Entry"
          value={entry}
          onChange={setEntry}
          placeholder="0.00"
        />
        <LabeledInput
          label={`SL (${direction === "LONG" ? "< entry" : "> entry"})`}
          value={sl}
          onChange={setSl}
          placeholder="0.00"
          warn={calc?.invalid}
        />
        <div className="flex flex-col gap-0.5">
          <span className="text-text-t4 font-mono text-2xs tracking-wider">Leverage</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={125}
              step={1}
              value={lev}
              onChange={(e) => setLev(Math.max(1, Math.min(125, parseInt(e.target.value) || 1)))}
              className="w-full bg-bg-page border border-border rounded px-1.5 py-1 font-mono text-xs text-text-t1 text-right tabular-nums focus:outline-none focus:border-text-t3"
            />
            <span className="text-text-t4 font-mono text-2xs shrink-0">×</span>
          </div>
        </div>
      </div>

      {/* Invalid warning */}
      {calc?.invalid && (
        <p className="text-amber-400 font-mono text-2xs mb-2">
          ⚠ SL must be {direction === "LONG" ? "below" : "above"} entry
        </p>
      )}

      {/* Balance hint */}
      <p className="text-text-t4 font-mono text-2xs mb-3">
        Balance: <span className="text-text-t3">${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
      </p>

      {/* Results */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-border/40">
        <ResultRow
          label="Risk $"
          value={calc && !calc.invalid ? `$${calc.riskUsd.toFixed(2)}` : "—"}
          color="text-text-t1"
        />
        <ResultRow
          label="SL Distance"
          value={calc && !calc.invalid ? `${calc.slDistPct.toFixed(2)}%` : "—"}
          color="text-text-t3"
        />
        <ResultRow
          label="Notional"
          value={calc && !calc.invalid ? `$${calc.notional.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
          color="text-text-t3"
        />
        <ResultRow
          label="Margin"
          value={calc && !calc.invalid ? `$${calc.margin.toFixed(2)}` : "—"}
          color={
            calc && !calc.invalid
              ? calc.margin > balance * 0.5
                ? "text-red-400"
                : calc.margin > balance * 0.25
                ? "text-yellow-400"
                : "text-green-400"
              : "text-text-t3"
          }
        />
        <ResultRow
          label="Size (coins)"
          value={calc && !calc.invalid ? fmtCoins(calc.coins) : "—"}
          color="text-text-t1"
          wide
        />
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  warn,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`font-mono text-2xs tracking-wider ${warn ? "text-amber-400" : "text-text-t4"}`}>
        {label}
      </span>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-bg-page border rounded px-1.5 py-1 font-mono text-xs text-right tabular-nums focus:outline-none ${
          warn ? "border-amber-400/50 focus:border-amber-400" : "border-border focus:border-text-t3"
        } text-text-t1 w-full`}
      />
    </div>
  );
}

function ResultRow({
  label,
  value,
  color,
  wide,
}: {
  label: string;
  value: string;
  color: string;
  wide?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${wide ? "col-span-2" : ""}`}>
      <span className="text-text-t4 font-mono text-2xs tracking-wider">{label}</span>
      <span className={`font-mono text-xs font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function fmtCoins(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.001) return n.toFixed(6);
  return n.toExponential(3);
}
