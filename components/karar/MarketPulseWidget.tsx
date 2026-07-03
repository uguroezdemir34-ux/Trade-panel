"use client";

interface Props {
  value?: number;
  onClose?: () => void;
}

export function MarketPulseWidget({ value = 62, onClose }: Props) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-s2 border border-white/10 text-xs">
      {/* Spinner */}
      <span
        className="block w-3.5 h-3.5 rounded-full border-2 border-teal-400/30 border-t-teal-400"
        style={{ animation: "spin 1s linear infinite" }}
        aria-hidden
      />

      {/* Labels */}
      <div className="flex flex-col leading-none">
        <span className="font-bold tracking-widest uppercase text-[9px] text-teal-400">
          Market Pulse
        </span>
        <span className="text-[9px] text-text-t4 tracking-wide">
          AI Sentiment Index
        </span>
      </div>

      {/* Value */}
      <span className="font-mono font-bold text-sm text-white tabular-nums">
        {value}%
      </span>

      {/* Close */}
      {onClose && (
        <button
          onClick={onClose}
          className="ml-1 text-text-t4 hover:text-white transition-colors leading-none"
          aria-label="Market Pulse kapat"
        >
          ✕
        </button>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
