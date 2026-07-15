"use client";

/**
 * TRACK RECORD PANEL — dışa açık, şeffaf "canlı performans" paneli.
 *
 * Salt-sunum bileşeni — veri ÇEKMEZ. `lib/pnl/live-track-record.ts`'in
 * `computeLiveTrackRecord(userId)` çıktısını (server-side, Supabase
 * `trades` tablosundan, SADECE OKX-doğrulanmış trade'ler) prop olarak
 * alır. Hangi sayfa/route'ta, hangi userId için render edileceği bu
 * bileşenin kapsamı DIŞINDA — o bir ürün kararı (bkz. live-track-record.ts
 * dosya başı notu).
 *
 * Grafik: yeni bir kütüphane eklenmedi — projede zaten kullanılan,
 * bağımlılıksız equity curve bileşeni (components/pnl/EquityCurve.tsx,
 * saf SVG) doğrudan yeniden kullanılıyor.
 *
 * "Verified by OKX API" rozeti KOŞULLU: sadece verifiedTradeCount > 0
 * iken yeşil/güven verici gösterilir. verifiedTradeCount === 0 iken
 * (henüz hiç OKX-reconcile edilmiş trade yoksa) sahte/boş bir "verified"
 * iddiası göstermek yerine dürüst bir "henüz veri yok" durumu render
 * edilir — bkz. dosya sonu boş-durum bloğu.
 *
 * localStorage'daki backtest/scan verisine (HistoricalEdge.tsx'in
 * kaynağı) bu bileşen HİÇ dokunmuyor — bkz. live-track-record.ts'in
 * "manipüle edilemez" gerekçesi.
 */

import { EquityCurve } from "@/components/pnl/EquityCurve";
import type { LiveTrackRecordResult } from "@/lib/pnl/live-track-record";

interface Props {
  result: LiveTrackRecordResult;
}

export function TrackRecordPanel({ result }: Props): React.ReactElement {
  const { stats, equityPoints, verifiedTradeCount, totalClosedTradeCount, lastVerifiedAt } = result;
  const hasVerifiedData = verifiedTradeCount > 0;
  const unverifiedCount = totalClosedTradeCount - verifiedTradeCount;

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4">
      {/* Başlık + güven rozeti */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-mono text-sm font-semibold text-text-t1">
          QUANTIX OS — Canlı Performans Kaydı
        </h2>
        {hasVerifiedData ? (
          <span className="flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-950/30 px-2.5 py-1 font-mono text-2xs font-bold uppercase tracking-widest text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Verified by OKX API
          </span>
        ) : (
          <span className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-2xs font-bold uppercase tracking-widest text-text-t3">
            Doğrulanan Veri Yok
          </span>
        )}
      </div>

      {!hasVerifiedData ? (
        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="font-mono text-xs text-text-t3">
            Henüz OKX ile doğrulanmış (reconcile edilmiş) kapanmış işlem yok.
          </p>
          <p className="font-mono text-2xs text-text-t4">
            Sahte/tahmini bir istatistik gösterilmiyor — dürüstlük ilkesi gereği.
          </p>
        </div>
      ) : (
        <>
          {/* 4 metrik: Win Rate, Profit Factor, Max Drawdown, Sharpe */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Win Rate"
              value={`${(stats.winRate * 100).toFixed(1)}%`}
              sub={`${stats.winCount}/${stats.totalTrades}`}
            />
            <Stat
              label="Profit Factor"
              value={
                stats.profitFactor === null
                  ? "—"
                  : !isFinite(stats.profitFactor)
                    ? "∞"
                    : stats.profitFactor.toFixed(2)
              }
            />
            <Stat
              label="Max Drawdown"
              value={`-$${stats.maxDrawdownUsd.toFixed(2)}`}
              tone="down"
            />
            <Stat
              label="Sharpe"
              value={stats.sharpe === null ? "—" : stats.sharpe.toFixed(2)}
            />
          </div>

          {/* Equity curve — mevcut, sıfır-bağımlılıklı SVG bileşeni yeniden kullanılıyor */}
          <EquityCurve points={equityPoints} />

          {/* Şeffaflık notu — kaç işlem doğrulanmış, kaç tanesi hariç tutulmuş */}
          <div className="border-border/50 mt-4 border-t pt-3">
            <p className="font-mono text-2xs leading-relaxed text-text-t3">
              {verifiedTradeCount} işlem OKX orders-history API'siyle doğrulandı.
              {unverifiedCount > 0 && (
                <>
                  {" "}
                  {unverifiedCount} kapanmış işlem henüz doğrulanmadığı için bu
                  hesaba KATILMADI.
                </>
              )}
              {lastVerifiedAt !== null && (
                <>
                  {" "}
                  Son doğrulanan işlem:{" "}
                  {new Date(lastVerifiedAt).toLocaleDateString("tr-TR")}.
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "down";
}) {
  return (
    <div>
      <div
        className={`font-mono text-base font-bold tabular-nums ${
          tone === "down" ? "text-signal-amber" : "text-text-t1"
        }`}
      >
        {value}
      </div>
      <div className="text-text-t3 mt-0.5 font-mono text-2xs leading-tight tracking-wider">
        {label}
        {sub && <span className="ml-1 text-text-t4">({sub})</span>}
      </div>
    </div>
  );
}
