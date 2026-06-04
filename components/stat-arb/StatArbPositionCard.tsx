"use client";

import type { StatArbState, StatArbPosition } from "@/lib/exchange/stat-arb-executor";

interface StatArbPositionCardProps {
  state: StatArbState;
  position: StatArbPosition | null;
  pairA: string;
  pairB: string;
  currentZScore: number | null;
  onOpen: () => void;
  onClose: () => void;
  onReset: () => void;
  disabled?: boolean;
}

const STATE_LABELS: Record<StatArbState, string> = {
  flat: "Düz",
  opening: "Açılıyor…",
  open: "Açık",
  closing: "Kapanıyor…",
  leg_failure_recovery: "Bacak Hatası — Kurtarma",
  stuck: "STUCK — Manuel Müdahale",
};

const STATE_COLOR: Record<StatArbState, string> = {
  flat: "text-muted-foreground",
  opening: "text-yellow-400",
  open: "text-signal-green",
  closing: "text-yellow-400",
  leg_failure_recovery: "text-red-400",
  stuck: "text-red-500",
};

export function StatArbPositionCard({
  state,
  position,
  pairA,
  pairB,
  currentZScore,
  onOpen,
  onClose,
  onReset,
  disabled = false,
}: StatArbPositionCardProps) {
  const isFlat = state === "flat";
  const isOpen = state === "open";
  const isBusy = state === "opening" || state === "closing";
  const isStuck = state === "stuck";

  const sideLabel = position
    ? position.side === "long_A_short_B"
      ? `LONG ${pairA} / SHORT ${pairB}`
      : `SHORT ${pairA} / LONG ${pairB}`
    : null;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Pozisyon Yönetimi</h3>
        <span className={`text-xs font-mono font-semibold ${STATE_COLOR[state]}`}>
          {STATE_LABELS[state]}
        </span>
      </div>

      {/* Active position details */}
      {position && (
        <div className="bg-muted/30 rounded p-3 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Yön</span>
            <span className="text-foreground font-semibold">{sideLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Giriş Z-Score</span>
            <span className="text-foreground">{position.entryZScore.toFixed(3)}σ</span>
          </div>
          {currentZScore !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mevcut Z-Score</span>
              <span className="text-foreground">{currentZScore >= 0 ? "+" : ""}{currentZScore.toFixed(3)}σ</span>
            </div>
          )}
          {position.entryZScore !== null && currentZScore !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Z-Score Δ</span>
              <span className={`${Math.abs(currentZScore) < Math.abs(position.entryZScore) ? "text-signal-green" : "text-red-400"}`}>
                {(currentZScore - position.entryZScore).toFixed(3)}σ
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Açıldı</span>
            <span className="text-foreground">
              {new Date(position.openedAt).toLocaleTimeString("tr", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {isFlat && (
          <button
            onClick={onOpen}
            disabled={disabled || currentZScore === null}
            className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-signal-green/10 text-signal-green border border-signal-green/30 hover:bg-signal-green/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Pozisyon Aç
          </button>
        )}

        {isOpen && (
          <button
            onClick={onClose}
            disabled={disabled}
            className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Pozisyon Kapat
          </button>
        )}

        {isBusy && (
          <div className="flex-1 py-1.5 px-3 rounded text-xs font-semibold text-center text-muted-foreground border border-border">
            İşlem sürüyor…
          </div>
        )}

        {(isStuck || state === "leg_failure_recovery") && (
          <button
            onClick={onReset}
            className="flex-1 py-1.5 px-3 rounded text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            Sıfırla (Manuel)
          </button>
        )}
      </div>

      {isFlat && !position && (
        <p className="text-[10px] text-muted-foreground">
          Pozisyon açmak için Z-Score eşiği aşılmalıdır. Sinyali bekleyin veya manuel açın.
        </p>
      )}

      {isStuck && (
        <p className="text-[10px] text-red-400">
          ⚠️ Emergency close başarısız. Borsadan manuel kapatma gerekli.
        </p>
      )}
    </div>
  );
}
