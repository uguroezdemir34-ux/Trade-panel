"use client";

/**
 * OI VELOCITY CARD — Open Interest ivme analizi (tüm pair'ler).
 *
 * 15 pair desteği: velocity map'ten dinamik olarak render eder.
 * Kompakt liste: pair | rejim | skor | OI% | fiyat%
 */

import { useState, useEffect } from "react";
import type { OiVelocityResult } from "@/lib/market/oi-velocity";
import { PAIRS, type Pair } from "@/lib/constants/pairs";
import { useT } from "@/lib/i18n/context";
import { useMacroStore } from "@/lib/store/macroStore";

interface Props {
  velocity: Partial<Record<Pair, OiVelocityResult>>;
  loading: boolean;
}

const REGIME_META: Record<
  string,
  { label: string; color: string }
> = {
  aggressive_long:    { label: "Aggressive Long",  color: "#22C55E" },
  short_squeeze_risk: { label: "Squeeze Risk",     color: "#EF4444" },
  long_unwind:        { label: "Long Unwind",      color: "#F59E0B" },
  bear_exhaustion:    { label: "Bear Exhaustion",  color: "#3B82F6" },
  neutral:            { label: "Neutral",          color: "rgb(var(--text-t3))" },
};

function scoreColor(s: number): string {
  if (s >= 3) return "#22C55E";
  if (s >= 1) return "#86EFAC";
  if (s <= -3) return "#EF4444";
  if (s <= -1) return "#FCA5A5";
  return "rgb(var(--text-t3))";
}

// ── TEMPORARY DEBUG — remove after diagnosis ──────────────────
function OiDebugPanel() {
  const oi = useMacroStore((s) => s.oi);
  const oiSnapshots = useMacroStore((s) => s.oiSnapshots);
  const oiFetchedAt = useMacroStore((s) => s.oiFetchedAt);
  const oiLoading = useMacroStore((s) => s.oiLoading);
  const [lsVal, setLsVal] = useState<string>("?");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("quantix_oi_snaps_v1");
      if (!raw) { setLsVal("ABSENT"); return; }
      const parsed = JSON.parse(raw) as Record<string, unknown[]>;
      const counts = Object.entries(parsed)
        .map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : "?"}`)
        .join(" ");
      setLsVal(counts || "EMPTY_OBJ");
    } catch {
      setLsVal("PARSE_ERR");
    }
  }, []);

  const oiRows = PAIRS.slice(0, 5).map((p) => {
    const r = oi[p];
    const snaps = oiSnapshots[p]?.length ?? 0;
    return `${p}: oi=${r?.oi ?? "?"} oiCcy=${r?.oiCcy ?? "?"} src=${r?.source ?? "?"} snaps=${snaps}`;
  });

  const fetchedAgo = oiFetchedAt
    ? `${Math.round((Date.now() - oiFetchedAt) / 1000)}s ago`
    : "never";

  return (
    <div className="mt-2 rounded border border-yellow-500/50 bg-yellow-950/30 p-2 font-mono text-[9px] text-yellow-300">
      <div className="mb-1 font-bold">⚠ DEBUG (geçici)</div>
      <div>oiLoading={String(oiLoading)} | fetchedAt={fetchedAgo}</div>
      <div>velocity count={Object.keys(useMacroStore.getState().oiVelocity).length}</div>
      <div className="mt-1">OI fetch sonuçları (ilk 5):</div>
      {oiRows.map((r) => <div key={r}>{r}</div>)}
      <div className="mt-1">localStorage quantix_oi_snaps_v1:</div>
      <div className="break-all">{lsVal}</div>
    </div>
  );
}
// ── END DEBUG ──────────────────────────────────────────────────

export function OiVelocityCard({ velocity, loading }: Props): React.ReactElement {
  const t = useT();
  const hasData = Object.keys(velocity).length > 0;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("piyasa.oiVelocity.title")}
        </span>
        {loading && !hasData && (
          <span className="text-text-t4 animate-pulse font-mono text-2xs">{t("piyasa.oiVelocity.loading")}</span>
        )}
      </div>

      {/* Header */}
      <div className="mb-0.5 grid grid-cols-[44px_1fr_40px_48px_48px] gap-x-2 px-1">
        {["", t("piyasa.oiVelocity.colRegime"), t("piyasa.oiVelocity.colScore"), t("piyasa.oiVelocity.colOI"), t("piyasa.oiVelocity.colPrice")].map((h) => (
          <span key={h} className="text-text-t4 font-mono text-[9px] uppercase tracking-wider">
            {h}
          </span>
        ))}
      </div>

      <div className="divide-border/30 flex flex-col divide-y">
        {PAIRS.map((pair) => {
          const result = velocity[pair];
          const regime = result ? (REGIME_META[result.regime] ?? REGIME_META.neutral) : null;

          return (
            <div
              key={pair}
              className="grid grid-cols-[44px_1fr_40px_48px_48px] items-center gap-x-2 py-0.5 px-1"
            >
              <span className="text-text-t2 font-mono text-xs font-semibold">{pair}</span>

              {result && regime ? (
                <>
                  <span
                    className="truncate font-mono text-[9px] font-medium"
                    style={{ color: regime.color }}
                  >
                    {regime.label}
                  </span>
                  <span
                    className="text-right font-mono text-xs font-bold tabular-nums"
                    style={{ color: scoreColor(result.oiVelocityScore) }}
                  >
                    {result.oiVelocityScore >= 0 ? "+" : ""}
                    {result.oiVelocityScore.toFixed(1)}
                  </span>
                  <span className="text-text-t3 text-right font-mono text-[9px] tabular-nums">
                    {result.oiChangePct >= 0 ? "+" : ""}
                    {result.oiChangePct.toFixed(2)}%
                  </span>
                  <span className="text-text-t3 text-right font-mono text-[9px] tabular-nums">
                    {result.priceChangePct >= 0 ? "+" : ""}
                    {result.priceChangePct.toFixed(2)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-text-t4 font-mono text-[9px]">—</span>
                  <span className="text-text-t4 font-mono text-xs text-right">—</span>
                  <span />
                  <span />
                </>
              )}
            </div>
          );
        })}
      </div>

      <OiDebugPanel />
    </div>
  );
}
