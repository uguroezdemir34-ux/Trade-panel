"use client";

import { useState } from "react";
import PozisyonPage from "@/app/pozisyon/page";
import PiyasaPage from "@/app/piyasa/page";
import RiskPage from "@/app/risk/page";
import PnlPage from "@/app/pnl/page";
import BacktestPage from "@/app/backtest/page";
import AyarlarPage from "@/app/ayarlar/page";

const SECTIONS = [
  { id: "pozisyon", icon: "💼", label: "Pozisyon",  Component: PozisyonPage },
  { id: "piyasa",   icon: "🌐", label: "Piyasa",    Component: PiyasaPage   },
  { id: "risk",     icon: "🛡️", label: "Risk",      Component: RiskPage     },
  { id: "pnl",      icon: "💰", label: "P&L",       Component: PnlPage      },
  { id: "backtest", icon: "🔬", label: "Backtest",   Component: BacktestPage },
  { id: "ayarlar",  icon: "⚙️", label: "Ayarlar",   Component: AyarlarPage  },
] as const;

export default function AnalyzPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({ pozisyon: true });

  function toggle(id: string) {
    setOpen((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="flex flex-col gap-1.5 py-2">
      {SECTIONS.map(({ id, icon, label, Component }) => {
        const isOpen = !!open[id];
        return (
          <div key={id} className="overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => toggle(id)}
              className="flex w-full items-center justify-between bg-bg-card px-4 py-3 font-mono text-sm font-semibold text-text-t1 transition-colors hover:bg-surface-s1"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{icon}</span>
                <span>{label}</span>
              </span>
              <span className="text-text-t4 text-xs">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-border">
                <Component />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
