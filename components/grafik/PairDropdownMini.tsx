"use client";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

interface Props {
  value: Pair;
  onChange: (p: Pair) => void;
}

export function PairDropdownMini({ value, onChange }: Props) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Pair)}
        className="appearance-none cursor-pointer rounded border border-border bg-bg-card px-2 py-0.5 pr-5 max-w-[4.5rem] font-mono text-2xs font-bold text-text-t1 uppercase tracking-wider transition-colors hover:border-text-t3 focus:outline-none focus:border-text-t2"
      >
        {PAIRS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-text-t4"
        width="8" height="8" viewBox="0 0 8 8"
      >
        <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
