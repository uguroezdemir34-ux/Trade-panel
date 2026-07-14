"use client";

/**
 * CORRELATION CARD — Korelasyon Matrisi'nin seçilebilir-anchor görünümü.
 *
 * Tam 24×24 grid mobilde okunmaz (576 hücre) — bunun yerine matrisin TEK
 * BİR SATIRINI gösteriyoruz: kullanıcı bir "anchor" pair seçer (default
 * BTC — önceki davranışla birebir aynı varsayılan görünüm), o pair'in
 * diğer 23'e karşı 30 günlük getiri korelasyonu listelenir. Anchor'ı
 * değiştirerek matrisin istenen herhangi bir satırı görülebilir.
 *
 * Pearson hesabı artık lib/market/correlation.ts'teki paylaşılan
 * `computeAnchorCorrelations()`'tan geliyor (önceden bu dosyada kendi
 * kopya pearson/dailyReturns'ü vardı — components/karar/CorrelationWarning.tsx
 * zaten shared modülü kullanıyordu, bu dosya kullanmıyordu; anchor'ı
 * genelleştirirken bu tutarsızlık da giderildi).
 */

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/context";
import { useCandleStore } from "@/lib/store/candleStore";
import { computeAnchorCorrelations } from "@/lib/market/correlation";
import { PAIRS, type Pair } from "@/lib/constants/pairs";

const WINDOW = 30; // last N daily candles for correlation

function corrColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.8) return r > 0 ? "text-green-300" : "text-red-300";
  if (abs >= 0.6) return r > 0 ? "text-green-400/80" : "text-red-400/80";
  if (abs >= 0.4) return "text-yellow-400/80";
  return "text-text-t4";
}

function corrBar(r: number): { width: number; color: string } {
  return {
    width: Math.abs(r) * 100,
    color: Math.abs(r) >= 0.8 ? (r > 0 ? "bg-green-400/50" : "bg-red-400/50") :
           Math.abs(r) >= 0.6 ? (r > 0 ? "bg-green-400/35" : "bg-red-400/35") :
           Math.abs(r) >= 0.4 ? "bg-yellow-400/35" : "bg-border/30",
  };
}

export function CorrelationCard(): React.ReactElement | null {
  const t = useT();
  const allCandles = useCandleStore((s) => s.candles);
  const [anchor, setAnchor] = useState<Pair>("BTC");

  const rows = useMemo(
    () => computeAnchorCorrelations(allCandles, anchor, WINDOW),
    [allCandles, anchor],
  );

  if (!rows || rows.length === 0) return null;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-text-t3 font-mono text-2xs tracking-widest uppercase">
          {t("piyasa.correlationCard.title", { anchor, window: String(WINDOW) })}
        </h3>
        <select
          value={anchor}
          onChange={(e) => setAnchor(e.target.value as Pair)}
          className="border-border bg-bg-card2 text-text-t2 rounded border font-mono text-2xs px-1.5 py-0.5"
          aria-label="Anchor pair"
        >
          {PAIRS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        {rows.map(({ pair, r }) => {
          const bar = corrBar(r);
          return (
            <div key={pair} className="grid items-center gap-x-2 font-mono text-xs" style={{ gridTemplateColumns: "40px 1fr 40px" }}>
              <span className="text-text-t2 text-2xs font-semibold">{pair}</span>
              <div className="h-2 rounded-sm bg-border/20 overflow-hidden">
                <div className={`h-full rounded-sm ${bar.color}`} style={{ width: `${bar.width}%` }} />
              </div>
              <span className={`tabular-nums text-right text-2xs ${corrColor(r)}`}>
                {r >= 0 ? "+" : ""}{r.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-text-t4 font-mono text-2xs mt-3">
        {t("piyasa.correlationCard.desc", { anchor })}
      </p>
    </div>
  );
}
