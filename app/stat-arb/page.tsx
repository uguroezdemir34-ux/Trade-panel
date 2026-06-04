"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStatArbStore } from "@/lib/store/statArbStore";
import { useCandleStore } from "@/lib/store/candleStore";
import {
  analyzeStatArb,
  estimateHedgeRatio,
  computePairCorrelation,
} from "@/lib/indicators/stat-arb";
import type { PricePair } from "@/lib/indicators/stat-arb";
import { runStatArbBacktest } from "@/lib/backtest/statArbBacktest";
import type { StatArbBacktestResult } from "@/lib/backtest/statArbBacktest";
import type { Candle } from "@/lib/okx/candles";
import { PairSelector } from "@/components/stat-arb/PairSelector";
import { ZScoreMeter } from "@/components/stat-arb/ZScoreMeter";
import { SpreadChart } from "@/components/stat-arb/SpreadChart";
import { StatArbPositionCard } from "@/components/stat-arb/StatArbPositionCard";
import { StatArbBacktestCard } from "@/components/stat-arb/StatArbBacktestCard";

// ─── Yardımcı ────────────────────────────────────────────────

function alignCandlesToPricePairs(
  candlesA: readonly Candle[],
  candlesB: readonly Candle[],
): PricePair[] {
  const mapB = new Map<number, number>();
  for (const c of candlesB) mapB.set(c.ts, c.close);

  const result: PricePair[] = [];
  for (const c of candlesA) {
    const pb = mapB.get(c.ts);
    if (pb !== undefined && c.close > 0 && pb > 0) {
      result.push({ timestamp: c.ts, priceA: c.close, priceB: pb });
    }
  }
  return result.sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Sayfa ────────────────────────────────────────────────────

export default function StatArbPage() {
  const {
    pairA, pairB,
    config,
    executorState, position,
    zScoreHistory,
    hedgeRatio, correlation, currentZScore,
    setPairA, setPairB, setConfig,
    setExecutorState, setPosition,
    pushZScore, setHedgeRatio, setCorrelation,
    resetHistory,
  } = useStatArbStore();

  const [btResult, setBtResult] = useState<StatArbBacktestResult | null>(null);
  const [btLoading, setBtLoading] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // Candle store
  const candlesA = useCandleStore((s) => s.candles[`${pairA}_1h`] ?? []);
  const candlesB = useCandleStore((s) => s.candles[`${pairB}_1h`] ?? []);


  // Recompute z-score when candles change
  useEffect(() => {
    if (candlesA.length < 10 || candlesB.length < 10) return;

    const aligned = alignCandlesToPricePairs(candlesA, candlesB);
    if (aligned.length < 10) return;

    // Estimate hedge ratio & correlation
    const beta = estimateHedgeRatio(aligned);
    const corr = computePairCorrelation(aligned);
    setHedgeRatio(beta);
    setCorrelation(corr);

    const effectiveBeta = beta ?? config.hedgeRatio;
    const analysis = analyzeStatArb(
      pairA, pairB, aligned,
      { ...config, hedgeRatio: effectiveBeta },
      position !== null && executorState === "open",
      position?.side === "long_A_short_B" ? "long_A" : position ? "short_A" : undefined,
    );

    if (analysis.zScoreResult?.reliable) {
      const lastAligned = aligned[aligned.length - 1];
      pushZScore({
        timestamp: lastAligned.timestamp,
        zScore: analysis.zScoreResult.zScore,
        spread: analysis.zScoreResult.spread,
      });
    }
  }, [candlesA, candlesB]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset history when pair changes
  const prevPairs = useRef(`${pairA}_${pairB}`);
  useEffect(() => {
    const key = `${pairA}_${pairB}`;
    if (key !== prevPairs.current) {
      prevPairs.current = key;
      resetHistory();
      setBtResult(null);
    }
  }, [pairA, pairB, resetHistory]);

  // Run backtest
  const handleRunBacktest = useCallback(() => {
    if (candlesA.length < 50 || candlesB.length < 50) return;
    setBtLoading(true);
    // Run async to avoid blocking render
    setTimeout(() => {
      const result = runStatArbBacktest(
        pairA, pairB,
        candlesA.filter((c) => c.confirm),
        candlesB.filter((c) => c.confirm),
        { ...config, hedgeRatio: hedgeRatio ?? config.hedgeRatio },
      );
      setBtResult(result);
      setBtLoading(false);
    }, 0);
  }, [candlesA, candlesB, pairA, pairB, config, hedgeRatio]);

  // Position management (paper mode — no live execution without OKX API)
  const handleOpenPosition = useCallback(() => {
    if (!currentZScore || executorState !== "flat") return;
    const side = currentZScore >= config.entryThreshold
      ? "short_A_long_B" as const
      : "long_A_short_B" as const;
    // Simulate open (paper)
    setPosition({
      id: `sa_paper_${Date.now()}`,
      side,
      legA: {
        pair: pairA, direction: side === "long_A_short_B" ? "LONG" : "SHORT",
        qty: 0, orderId: "paper", ok: true, sentAt: Date.now(), resolvedAt: Date.now(),
      },
      legB: {
        pair: pairB, direction: side === "long_A_short_B" ? "SHORT" : "LONG",
        qty: 0, orderId: "paper", ok: true, sentAt: Date.now(), resolvedAt: Date.now(),
      },
      openedAt: Date.now(),
      closedAt: null,
      entryZScore: currentZScore,
      exitZScore: null,
      pnlEstimate: null,
    });
    setExecutorState("open");
  }, [currentZScore, executorState, config.entryThreshold, pairA, pairB, setPosition, setExecutorState]);

  const handleClosePosition = useCallback(() => {
    if (!position || executorState !== "open") return;
    setPosition({ ...position, closedAt: Date.now(), exitZScore: currentZScore });
    setExecutorState("flat");
    setPosition(null);
  }, [position, executorState, currentZScore, setPosition, setExecutorState]);

  const handleReset = useCallback(() => {
    setExecutorState("flat");
    setPosition(null);
  }, [setExecutorState, setPosition]);

  const isDataReady = candlesA.length >= 30 && candlesB.length >= 30;
  const hasLiveZ = currentZScore !== null;
  const entrySignal = hasLiveZ && Math.abs(currentZScore!) >= config.entryThreshold;

  const corrColor =
    correlation === null ? "text-muted-foreground" :
    Math.abs(correlation) >= 0.8 ? "text-signal-green" :
    Math.abs(correlation) >= 0.6 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Stat-Arb</h1>
          <p className="text-xs text-muted-foreground">İstatistiksel Arbitraj — Spread Analizi</p>
        </div>
        <button
          onClick={() => setConfigOpen((v) => !v)}
          className="text-xs text-primary font-mono hover:underline"
        >
          {configOpen ? "▲ Kapat" : "▼ Ayarlar"}
        </button>
      </div>

      {/* Pair selector */}
      <div className="bg-card border border-border rounded-lg p-4">
        <PairSelector
          pairA={pairA}
          pairB={pairB}
          onChangeA={setPairA}
          onChangeB={setPairB}
        />

        {/* Correlation & hedge ratio info */}
        <div className="flex gap-4 mt-3 text-xs font-mono">
          <span className="text-muted-foreground">
            Korelasyon:{" "}
            <span className={corrColor}>
              {correlation !== null ? (correlation >= 0 ? "+" : "") + correlation.toFixed(3) : "—"}
            </span>
          </span>
          <span className="text-muted-foreground">
            Hedge β: <span className="text-foreground">{hedgeRatio !== null ? hedgeRatio.toFixed(4) : "—"}</span>
          </span>
          {!isDataReady && (
            <span className="text-yellow-500">⚠ Mum verisi bekleniyor…</span>
          )}
        </div>
      </div>

      {/* Config panel */}
      {configOpen && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold">Konfigürasyon</h3>
          <div className="grid grid-cols-2 gap-3">
            <ConfigSlider
              label="Window"
              value={config.window}
              min={10}
              max={100}
              step={5}
              onChange={(v) => setConfig({ window: v })}
            />
            <ConfigSlider
              label="Giriş Eşiği (σ)"
              value={config.entryThreshold}
              min={1.0}
              max={4.0}
              step={0.1}
              onChange={(v) => setConfig({ entryThreshold: v })}
              decimal
            />
            <ConfigSlider
              label="Çıkış Eşiği (σ)"
              value={config.exitThreshold}
              min={0.0}
              max={1.5}
              step={0.1}
              onChange={(v) => setConfig({ exitThreshold: v })}
              decimal
            />
            <ConfigSlider
              label="Acil Eşik (σ)"
              value={config.emergencyThreshold}
              min={3.0}
              max={6.0}
              step={0.5}
              onChange={(v) => setConfig({ emergencyThreshold: v })}
              decimal
            />
          </div>
        </div>
      )}

      {/* Live Z-Score */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Canlı Z-Score</h2>
          {entrySignal && (
            <span className="text-[10px] font-semibold text-signal-green bg-signal-green/10 border border-signal-green/30 rounded px-2 py-0.5 animate-pulse">
              GİRİŞ SİNYALİ
            </span>
          )}
        </div>
        <ZScoreMeter
          zScore={currentZScore}
          entryThreshold={config.entryThreshold}
          exitThreshold={config.exitThreshold}
          emergencyThreshold={config.emergencyThreshold}
        />
      </div>

      {/* Live spread chart */}
      {zScoreHistory.length >= 3 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold">Z-Score Grafiği (Canlı)</h2>
          <SpreadChart
            data={zScoreHistory}
            entryThreshold={config.entryThreshold}
            exitThreshold={config.exitThreshold}
            emergencyThreshold={config.emergencyThreshold}
          />
        </div>
      )}

      {/* Position management */}
      <StatArbPositionCard
        state={executorState}
        position={position}
        pairA={pairA}
        pairB={pairB}
        currentZScore={currentZScore}
        onOpen={handleOpenPosition}
        onClose={handleClosePosition}
        onReset={handleReset}
        disabled={!isDataReady}
      />

      {/* Paper mode notice */}
      <div className="text-[10px] text-muted-foreground bg-muted/20 border border-border rounded px-3 py-2">
        📋 <span className="font-semibold">Paper mode:</span> Pozisyon yönetimi simüle edilir. Canlı emir yürütümü için StatArbExecutor + OKX API anahtarları gereklidir.
      </div>

      {/* Backtest */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Spread Analizi (Geçmiş)</h2>
          <button
            onClick={handleRunBacktest}
            disabled={!isDataReady || btLoading}
            className="text-xs font-semibold py-1 px-3 rounded bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {btLoading ? "Hesaplanıyor…" : "Analiz Et"}
          </button>
        </div>

        {!isDataReady && (
          <p className="text-xs text-muted-foreground">Analiz için her iki pair'in mum verisi yüklü olmalı.</p>
        )}
      </div>

      {btResult && (
        <StatArbBacktestCard
          result={btResult}
          entryThreshold={config.entryThreshold}
          exitThreshold={config.exitThreshold}
          emergencyThreshold={config.emergencyThreshold}
        />
      )}
    </div>
  );
}

// ─── Config Slider ────────────────────────────────────────────

function ConfigSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  decimal = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  decimal?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{decimal ? value.toFixed(1) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-primary"
      />
    </div>
  );
}
