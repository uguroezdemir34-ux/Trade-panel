"use client";

import type { Pair } from "@/lib/constants/pairs";
import { useAiScenarioFetch } from "@/lib/hooks/useAiScenarioFetch";

interface Props {
  pair: Pair;
}

// lib/analysis/telegram-format.ts'teki directionLabel'ın KOPYASI — o dosya
// server-only DEĞİL ama bu bilinçli bir kopya (import yerine), aynı desen
// app/api/ai-scenario/route.ts'teki VALID_SYMBOLS yerel kopyasında da var.
// Aynı >=60/<=40 eşiği iki dosyada da elle senkron tutulmalı.
function directionLabel(score: number): string {
  if (score >= 60) return "Boğa eğilimli";
  if (score <= 40) return "Ayı eğilimli";
  return "Nötr";
}

// app/api/ai-scenario/route.ts'teki VALID_SYMBOLS ile AYNI 3 sembol — yerel
// kopya, aynı gerekçe (o dosyanın header yorumuna bkz.).
const SUPPORTED_SYMBOLS = ["BTC", "ETH", "SOL"] as const;
type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

function isSupported(pair: Pair): pair is SupportedSymbol {
  return (SUPPORTED_SYMBOLS as readonly string[]).includes(pair);
}

export function AiScenarioTab({ pair }: Props) {
  // pair desteklenmiyorsa hook'a url=null geçiyoruz — hook hiç fetch
  // etmiyor, "desteklenmiyor" JSX dalı zaten state'e hiç bakmadan aşağıda
  // ayrıca ele alınıyor (useAiScenarioFetch.ts dosya başı yorumuna bkz.).
  const state = useAiScenarioFetch(
    isSupported(pair) ? `/api/ai-scenario?symbol=${encodeURIComponent(pair)}` : null,
  );

  if (!isSupported(pair)) {
    return (
      <div className="flex items-center justify-center py-12 px-4 text-center">
        <p className="font-mono text-xs text-text-t3">
          Bu analiz şu an sadece BTC/ETH/SOL için üretiliyor.
        </p>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-xs text-text-t4">Yükleniyor…</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-center py-12 px-4 text-center">
        <p className="font-mono text-xs text-red-400">
          AI Senaryo verisi yüklenemedi — az sonra tekrar deneyin.
        </p>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="flex items-center justify-center py-12 px-4 text-center">
        <p className="font-mono text-xs text-text-t3">
          {pair} için henüz bir AI Senaryo üretilmedi — cron ilk çalıştığında burada görünecek.
        </p>
      </div>
    );
  }

  const { row } = state;
  const { score, sr_levels } = row;

  return (
    <div className="flex flex-col gap-3 p-3">
      {row.chart_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.chart_image_url}
          alt={`${row.symbol} AI Senaryo grafiği`}
          className="w-full rounded border border-border"
        />
      ) : (
        <div className="flex items-center justify-center h-40 rounded border border-border bg-bg-card">
          <span className="font-mono text-2xs text-text-t4">Görsel üretilemedi</span>
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold text-text-t1">{score.score}/100</span>
        <span className="font-mono text-xs text-text-t3">({directionLabel(score.score)})</span>
      </div>

      {(sr_levels.nearest_resistance || sr_levels.nearest_support) && (
        <div className="flex flex-col gap-1 font-mono text-xs text-text-t2">
          {sr_levels.nearest_resistance && (
            <span>
              Direnç: ${sr_levels.nearest_resistance.price} (%{sr_levels.nearest_resistance.distance_pct} uzak)
            </span>
          )}
          {sr_levels.nearest_support && (
            <span>
              Destek: ${sr_levels.nearest_support.price} (%{sr_levels.nearest_support.distance_pct} uzak)
            </span>
          )}
        </div>
      )}

      <p className="font-mono text-2xs text-text-t4">{score.disclaimer}</p>

      <p className="font-mono text-2xs text-text-t4 opacity-60">
        Son güncelleme: {new Date(row.created_at).toLocaleString("tr-TR")}
      </p>
    </div>
  );
}
