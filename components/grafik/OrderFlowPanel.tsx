"use client";

/**
 * ORDER FLOW PANEL — DOM + Tape + Cluster sekme konteyneri.
 *
 * useOrderbookPoller burada mount edilir → bu panel açıkken polling başlar,
 * kapanınca durur. AppShell'e ekleme gerekmez.
 */

import { useState } from "react";
import type { Pair } from "@/lib/constants/pairs";
import { useOrderbookStore } from "@/lib/store/orderbookStore";
import { useOrderbookPoller } from "@/lib/hooks/useOrderbookPoller";
import { DepthChart } from "./DepthChart";
import { TapeReader } from "./TapeReader";
import { ClusterChart } from "./ClusterChart";

type FlowTab = "dom" | "tape" | "cluster";

const TABS: { id: FlowTab; label: string }[] = [
  { id: "dom",     label: "DOM" },
  { id: "tape",    label: "TAPE" },
  { id: "cluster", label: "CLUSTER" },
];

interface Props {
  pair: Pair;
}

export function OrderFlowPanel({ pair }: Props) {
  const [tab, setTab] = useState<FlowTab>("dom");

  // Start polling when this panel is mounted
  useOrderbookPoller(pair);

  const snapshot = useOrderbookStore((s) => s.snapshots[pair] ?? null);

  return (
    <div className="rounded-lg border border-border bg-bg-card overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-surface-s1">
        <div className="flex px-2 gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 font-mono text-2xs tracking-widest uppercase transition-colors ${
                tab === t.id
                  ? "text-brand border-b-2 border-brand"
                  : "text-text-t3 hover:text-text-t2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center pr-3">
          <span className="font-mono text-2xs text-text-t4 uppercase tracking-wider">{pair}</span>
          {snapshot && (
            <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[200px]">
        {tab === "dom"     && <DepthChart snapshot={snapshot} maxLevels={10} />}
        {tab === "tape"    && <TapeReader pair={pair} maxRows={60} />}
        {tab === "cluster" && <ClusterChart pair={pair} maxBuckets={15} />}
      </div>
    </div>
  );
}
