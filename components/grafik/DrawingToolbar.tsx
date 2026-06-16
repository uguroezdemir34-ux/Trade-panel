"use client";

import type { ChartClickMode } from "./ChartControls";
import { useT } from "@/lib/i18n/context";

interface Props {
  clickMode: ChartClickMode;
  onSetClickMode: (mode: ChartClickMode) => void;
  hasDrawings: boolean;
  pendingPoint: boolean;
  onClearAll: () => void;
}

const TOOLS: Array<{ mode: ChartClickMode; icon: string; titleKey: string }> = [
  { mode: "none",        icon: "↖", titleKey: "grafik.toolCursor"      },
  { mode: "hline",       icon: "─", titleKey: "grafik.toolHline"        },
  { mode: "ray",         icon: "→", titleKey: "grafik.toolRay"          },
  { mode: "trendline",   icon: "╱", titleKey: "grafik.toolTrendline"    },
  { mode: "extline",     icon: "↔", titleKey: "grafik.toolExtline"      },
  { mode: "channel",     icon: "∥", titleKey: "grafik.toolChannel"      },
  { mode: "fibonacci",   icon: "φ", titleKey: "grafik.fibonacci"        },
  { mode: "fibext",      icon: "Φ", titleKey: "grafik.fibext"           },
  { mode: "vline",       icon: "│", titleKey: "grafik.toolVline"        },
  { mode: "crossline",   icon: "⊕", titleKey: "grafik.toolCrossline"   },
  { mode: "fibtimezone", icon: "Ψ", titleKey: "grafik.toolFibTimezone" },
];

export function DrawingToolbar({
  clickMode,
  onSetClickMode,
  hasDrawings,
  pendingPoint,
  onClearAll,
}: Props): React.ReactElement {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-0.5 px-0.5 py-1 bg-bg-card border-r border-border shrink-0 rounded-l-lg">
      {TOOLS.map(({ mode, icon, titleKey }) => {
        const isActive  = clickMode === mode && mode !== "none";
        const isPending = pendingPoint && clickMode === mode;
        return (
          <button
            key={mode}
            title={t(titleKey)}
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
            title={t("grafik.clearLines")}
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
