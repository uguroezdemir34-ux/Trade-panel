"use client";

/**
 * AI'YA SOR — açık pozisyon durum-kontrolü butonu.
 *
 * Sadece tıklamayla tetiklenir (periyodik/arka plan çağrı YOK). Client'ta
 * ZATEN hesaplanmış scoreStore sonucunu + canlı fiyatı /api/ai/position-check
 * route'una gönderir; route giriş-anı score_history satırını arar ve
 * Anthropic'e karşılaştırtır (bkz. route dosyasının header'ı). Bu bileşen
 * YENİ bir skor hesaplamaz, lib/score/*'a hiç dokunmaz.
 *
 * Rate limit — iki katman:
 *   1. Client-side: başarılı/hata sonrası cooldownUntil set edilir, buton
 *      o süre boyunca disabled (gereksiz 429'ları önler, tek bir setTimeout
 *      ile — polling yok).
 *   2. Server-side: route'taki modül-scope Map (bkz. route.ts header'ı,
 *      serverless caveat'ı orada belgeli).
 * Sunucu 429 dönerse (client'ın kendi cooldown'ı bir şekilde atlanmışsa —
 * ör. iki sekme açıkken) server'ın retryAfterMs'i client cooldown'ını
 * override eder.
 */

import { useEffect, useState } from "react";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useMarketStore } from "@/lib/store/marketStore";
import { computeRoe } from "@/lib/sizer/position-pnl";
import { useT } from "@/lib/i18n/context";
import { isSupportedPair } from "@/lib/constants/pairs";
import type { Position } from "@/lib/okx/positions";

const SUCCESS_COOLDOWN_MS = 90_000; // route.ts'teki COOLDOWN_MS ile aynı
const ERROR_RETRY_COOLDOWN_MS = 10_000; // hata sonrası daha kısa — kullanıcı hemen tekrar deneyebilsin

type Phase = "idle" | "loading" | "result" | "error";

interface ResultData {
  status: "green" | "yellow" | "red";
  message: string;
  note?: string;
}

const STATUS_EMOJI: Record<ResultData["status"], string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

interface ApiResponse {
  ok: boolean;
  status?: "green" | "yellow" | "red";
  message?: string;
  note?: string;
  error?: string;
  retryAfterMs?: number;
}

export function AiCheckButton({ position }: { position: Position }): React.ReactElement | null {
  const t = useT();
  const scoreResult = useScoreStore((s) => s.results[position.pair]);
  const livePrice = useMarketStore((s) => s.prices[position.pair]?.last ?? null);
  // WS sadece skorlanan paritelere abone (bkz. lib/store/marketStore.ts
  // başı) — desteklenmeyen bir paritede livePrice hiçbir zaman dolmaz, bu
  // durumda borsanın 10sn'de bir çektiği markPx'e (usePositionPoller
  // snapshot'ı) düşülür. Zaten desteklenmeyen paritede bu component altta
  // erken return ediyor, ama supported bir paritede de WS henüz ilk tick'i
  // atmamışsa aynı fallback devreye girer.
  const currentPrice = livePrice ?? position.markPx;

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ResultData | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  useEffect(() => {
    if (cooldownUntil === null) {
      setIsCoolingDown(false);
      return;
    }
    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) {
      setIsCoolingDown(false);
      setCooldownUntil(null);
      return;
    }
    setIsCoolingDown(true);
    const timer = setTimeout(() => {
      setIsCoolingDown(false);
      setCooldownUntil(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [cooldownUntil]);

  if (position.direction === "NEUTRAL") return null;

  // PAIRS dışı bir paritede pozisyon açılmışsa (bkz. lib/okx/positions.ts
  // extractPair() — artık filtrelenmiyor, panelde görünüyor) skor hiç
  // hesaplanmaz — sessizce gizlemek yerine açıkça "desteklenmiyor" diyoruz.
  if (!isSupportedPair(position.pair)) {
    return (
      <div className="mt-2 font-mono text-2xs italic text-text-t4">
        {t("aiCheck.notSupported")}
      </div>
    );
  }

  if (!scoreResult) return null;

  async function handleClick(): Promise<void> {
    setPhase("loading");
    try {
      const roe = computeRoe(position, currentPrice);
      const res = await fetch("/api/ai/position-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pair: position.pair,
          direction: position.direction,
          entryCTime: position.cTime,
          currentPrice,
          currentPnlPct: roe,
          currentSnapshot: {
            score: scoreResult.score,
            verdict: scoreResult.verdict,
            direction: scoreResult.direction,
            dirConfidence: scoreResult.dirConfidence,
            regime: scoreResult.regime,
            blocks: scoreResult.blocks,
            softBlocks: scoreResult.softBlocks,
            sub: scoreResult.sub,
          },
        }),
        signal: AbortSignal.timeout(20_000),
      });

      const data = (await res.json()) as ApiResponse;

      if (res.status === 429) {
        setCooldownUntil(Date.now() + (data.retryAfterMs ?? SUCCESS_COOLDOWN_MS));
        setPhase("error");
        return;
      }

      if (!data.ok || !data.status || !data.message) {
        setCooldownUntil(Date.now() + ERROR_RETRY_COOLDOWN_MS);
        setPhase("error");
        return;
      }

      setResult({ status: data.status, message: data.message, note: data.note });
      setCooldownUntil(Date.now() + SUCCESS_COOLDOWN_MS);
      setPhase("result");
    } catch {
      setCooldownUntil(Date.now() + ERROR_RETRY_COOLDOWN_MS);
      setPhase("error");
    }
  }

  const disabled = phase === "loading" || isCoolingDown;

  return (
    <div className="mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          void handleClick();
        }}
        disabled={disabled}
        className="w-full rounded-md border border-border/50 bg-surface-s2 px-2.5 py-1.5 font-mono text-2xs font-semibold text-text-t2 transition-colors hover:bg-surface-s1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {phase === "loading" ? t("aiCheck.loading") : t("aiCheck.button")}
      </button>

      {phase === "result" && result && (
        <div className="mt-1.5 rounded-md border border-border/50 bg-surface-s2 px-2.5 py-2">
          <span className="font-mono text-xs font-bold">{STATUS_EMOJI[result.status]}</span>
          <div className="mt-1 font-mono text-2xs leading-relaxed text-text-t2">{result.message}</div>
          {result.note && (
            <div className="mt-1 font-mono text-2xs italic text-text-t4">{result.note}</div>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="mt-1.5 font-mono text-2xs text-red-400">{t("aiCheck.error")}</div>
      )}
    </div>
  );
}
