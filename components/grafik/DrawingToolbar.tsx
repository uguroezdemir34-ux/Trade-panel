"use client";

import type { ChartClickMode } from "./ChartControls";

interface Props {
  clickMode: ChartClickMode;
  onSetClickMode: (mode: ChartClickMode) => void;
  hasDrawings: boolean;
  pendingPoint: boolean;
  onClearAll: () => void;
}

const TOOLS: Array<{ mode: ChartClickMode; icon: string; title: string }> = [
  { mode: "none",        icon: "↖", title: "İmleç"              },
  { mode: "hline",       icon: "─", title: "Yatay Çizgi"        },
  { mode: "ray",         icon: "→", title: "Yatay Işın"         },
  { mode: "trendline",   icon: "╱", title: "Trend Çizgisi"      },
  { mode: "extline",     icon: "↔", title: "Uzayan Çizgi"       },
  { mode: "channel",     icon: "≡", title: "Paralel Kanal"      },
  { mode: "fibonacci",   icon: "φ", title: "Fibonacci"           },
  { mode: "fibext",      icon: "Φ", title: "Fib Extension"       },
  { mode: "vline",       icon: "│", title: "Dikey Çizgi"         },
  { mode: "crossline",   icon: "✛", title: "Cross Çizgi"         },
  { mode: "fibtimezone", icon: "ƒ", title: "Fib Zaman Dilimi"   },
];

export function DrawingToolbar({
  clickMode,
  onSetClickMode,
  hasDrawings,
  pendingPoint,
  onClearAll,
}: Props): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-0.5 px-0.5 py-1 bg-bg-card border-r border-border shrink-0 rounded-l-lg">
      {TOOLS.map(({ mode, icon, title }) => {
        const isActive  = clickMode === mode && mode !== "none";
        const isPending = pendingPoint && clickMode === mode;
        return (
          <button
            key={mode}
            title={title}
            onClick={() => onSetClickMode(isActive ? "none" : mode)}
            className={[
              "w-7 h-7 rounded flex items-center justify-center font-mono text-sm transition-colors select-none",
              isActive
                ? "bg-brand/20 text-brand border border-brand/40"
                : "text-text-t3 hover:text-text-t1 hover:bg-bg-hover border border-transparent",
              isPending ? "ring-1 ring-brand animate-pulse" : "",
            ].filter(Boolean).join(" ")}
          >
            {icon}
          </button>
        );
      })}

      {hasDrawings && (
        <>
          <div className="w-5 border-t border-border/40 my-0.5" />
          <button
            title="Tüm çizgileri sil"
            onClick={onClearAll}
            className="w-7 h-7 rounded flex items-center justify-center font-mono text-xs text-text-t4 hover:text-red-400 hover:bg-bg-hover transition-colors border border-transparent"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
