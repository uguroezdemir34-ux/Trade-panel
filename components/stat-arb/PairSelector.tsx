"use client";

import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";

interface PairSelectorProps {
  pairA: Pair;
  pairB: Pair;
  onChangeA: (p: Pair) => void;
  onChangeB: (p: Pair) => void;
}

export function PairSelector({ pairA, pairB, onChangeA, onChangeB }: PairSelectorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">Pair A</span>
        <select
          value={pairA}
          onChange={(e) => {
            const val = e.target.value as Pair;
            if (val !== pairB) onChangeA(val);
          }}
          className="bg-card border border-border rounded px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {PAIRS.map((p) => (
            <option key={p} value={p} disabled={p === pairB}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <span className="text-muted-foreground text-sm font-mono">⟷</span>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">Pair B</span>
        <select
          value={pairB}
          onChange={(e) => {
            const val = e.target.value as Pair;
            if (val !== pairA) onChangeB(val);
          }}
          className="bg-card border border-border rounded px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {PAIRS.map((p) => (
            <option key={p} value={p} disabled={p === pairA}>
              {p}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
