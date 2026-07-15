"use client";

/**
 * VERDICT BADGE — GO / WAIT / NO.
 * Büyük renkli pill, karar verici göstergesi.
 * 3D glossy gradient style — üst highlight, alt iç gölge, kabarık metalik his.
 */

import { useT } from "@/lib/i18n/context";

type Verdict = "go" | "wait" | "no";

const GRADIENT_STYLES: Record<Verdict, React.CSSProperties> = {
  go: {
    background: "linear-gradient(180deg, #2fd068 0%, #1a9e42 42%, #0e7030 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(180,255,200,0.38), inset 0 -2px 0 rgba(0,0,0,0.28), 0 2px 8px rgba(16,140,56,0.40)",
    border: "1px solid #0b5a26",
    color: "#fff",
  },
  wait: {
    background: "linear-gradient(180deg, #f2a832 0%, #cc7c18 42%, #9e5a08 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,220,160,0.38), inset 0 -2px 0 rgba(0,0,0,0.28), 0 2px 8px rgba(180,100,16,0.40)",
    border: "1px solid #7a4406",
    color: "#fff",
  },
  no: {
    background: "linear-gradient(180deg, #e85555 0%, #c42222 42%, #9a0e0e 100%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,180,180,0.38), inset 0 -2px 0 rgba(0,0,0,0.30), 0 2px 8px rgba(180,20,20,0.40)",
    border: "1px solid #7a0808",
    color: "#fff",
  },
};

const ICONS: Record<Verdict, string> = {
  go: "✓",
  wait: "⏸",
  no: "✕",
};

const LABEL_KEYS: Record<Verdict, string> = {
  go: "verdict.go",
  wait: "verdict.wait",
  no: "verdict.no",
};

export function VerdictBadge({
  verdict,
  signalType,
  hysteresisActive,
  hysteresisDetail,
}: {
  verdict: Verdict;
  signalType?: "classic" | "pullback";
  /** applyHysteresis() tetiklendi mi (bkz. ScoreResult.reasons.hysteresis) — "Kararlı Trend" rozeti gösterir. */
  hysteresisActive?: boolean;
  /** reasons.hysteresis'in ham metni — native title tooltip'te detay için, opsiyonel. */
  hysteresisDetail?: string;
}): React.ReactElement {
  const t = useT();

  return (
    <div className="flex items-center gap-2">
      <div
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-sm font-bold tracking-widest select-none"
        style={GRADIENT_STYLES[verdict]}
      >
        <span>{ICONS[verdict]}</span>
        <span>{t(LABEL_KEYS[verdict])}</span>
      </div>
      {signalType === "pullback" && (
        <span className="bg-soft-amber text-signal-amber rounded px-2 py-0.5 font-mono text-2xs tracking-wider">
          {t("verdict.pullback")}
        </span>
      )}
      {hysteresisActive && (
        <span
          className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/8 px-2 py-0.5 font-mono text-2xs tracking-wide text-emerald-400/80"
          title={hysteresisDetail}
        >
          <span>🔗</span>
          <span>{t("karar.hysteresisStable")}</span>
        </span>
      )}
    </div>
  );
}
