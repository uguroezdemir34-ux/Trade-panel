"use client";

interface ZScoreMeterProps {
  zScore: number | null;
  entryThreshold: number;
  exitThreshold: number;
  emergencyThreshold: number;
}

export function ZScoreMeter({
  zScore,
  entryThreshold,
  exitThreshold,
  emergencyThreshold,
}: ZScoreMeterProps) {
  const clampedZ = zScore !== null ? Math.max(-emergencyThreshold - 0.5, Math.min(emergencyThreshold + 0.5, zScore)) : 0;
  const maxAbs = emergencyThreshold + 0.5;
  // Map to 0..100 percent (50 = center)
  const pct = 50 + (clampedZ / maxAbs) * 50;

  const zAbs = zScore !== null ? Math.abs(zScore) : 0;
  let color = "bg-muted-foreground";
  if (zScore === null) color = "bg-muted-foreground";
  else if (zAbs >= emergencyThreshold) color = "bg-red-500";
  else if (zAbs >= entryThreshold) color = "bg-signal-green";
  else if (zAbs <= exitThreshold) color = "bg-muted-foreground/50";
  else color = "bg-yellow-500/70";

  const zStr = zScore !== null ? (zScore >= 0 ? "+" : "") + zScore.toFixed(3) : "—";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>−{emergencyThreshold.toFixed(1)}</span>
        <span className="text-foreground font-semibold text-sm">{zStr}σ</span>
        <span>+{emergencyThreshold.toFixed(1)}</span>
      </div>

      {/* Track */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        {/* Entry threshold bands */}
        <div
          className="absolute top-0 bottom-0 bg-signal-green/10"
          style={{
            left: `${50 + (entryThreshold / maxAbs) * 50}%`,
            right: "0%",
          }}
        />
        <div
          className="absolute top-0 bottom-0 bg-signal-green/10"
          style={{
            left: "0%",
            right: `${50 - (-entryThreshold / maxAbs) * 50}%`,
          }}
        />
        {/* Emergency bands */}
        <div
          className="absolute top-0 bottom-0 bg-red-500/20"
          style={{
            left: `${50 + (emergencyThreshold / maxAbs) * 50}%`,
            right: "0%",
          }}
        />
        <div
          className="absolute top-0 bottom-0 bg-red-500/20"
          style={{
            left: "0%",
            right: `${50 - (-emergencyThreshold / maxAbs) * 50}%`,
          }}
        />
        {/* Center line */}
        <div className="absolute top-0 bottom-0 w-px bg-border" style={{ left: "50%" }} />

        {/* Indicator */}
        {zScore !== null && (
          <div
            className={`absolute top-1 bottom-1 w-2 rounded-full transition-all duration-300 ${color}`}
            style={{ left: `calc(${pct}% - 4px)` }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>LONG A</span>
        <span>NÖTR</span>
        <span>SHORT A</span>
      </div>
    </div>
  );
}
