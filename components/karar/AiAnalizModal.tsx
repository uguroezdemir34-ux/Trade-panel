"use client";

/**
 * AI ANALİZ MODAL — /karar ve /grafik'teki "AI Analiz" butonunun açtığı
 * modal. Mount olunca app/api/signal/analyze/route.ts'e TEK bir POST atar
 * (pair + direction + score — score ZATEN client'ın elindeki scoreStore
 * sonucundan, burada asla yeniden hesaplanmaz), sonucu gösterir: görsel
 * grafik (PNG) + anlatım metni + sayısal detaylar.
 *
 * Görsel/dialog yapısı KeyboardShortcutsModal.tsx ile AYNI desen (backdrop +
 * ESC ile kapama) — üçüncü bir modal deseni icat edilmedi.
 */

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context";
import type { Pair } from "@/lib/constants/pairs";
import type { HumanTraderCheckResult } from "@/lib/signal/humanTraderCheck";

interface AnalyzeResponse {
  ok: boolean;
  error?: string;
  pair?: Pair;
  direction?: "LONG" | "SHORT";
  currentPrice?: number;
  image?: string | null;
  narrative?: string | null;
  humanCheck?: HumanTraderCheckResult;
  tradeLevels?: {
    entry: number;
    stopPrice: number | null;
    tp1Price: number | null;
    tp2Price: number | null;
  };
}

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AnalyzeResponse };

function fmtPrice(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function AiAnalizModal({
  pair,
  direction,
  score,
  onClose,
}: {
  pair: Pair;
  direction: "LONG" | "SHORT";
  score: number;
  onClose: () => void;
}): React.ReactElement {
  const t = useT();
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch("/api/signal/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair, direction, score }),
    })
      .then(async (res) => {
        const json = (await res.json()) as AnalyzeResponse;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          const key =
            json.error === "insufficient_data"
              ? "karar.aiAnalizInsufficientData"
              : json.error === "rate_limited"
              ? "karar.aiAnalizRateLimited"
              : "karar.aiAnalizError";
          setState({ status: "error", message: t(key) });
          return;
        }
        setState({ status: "ready", data: json });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", message: t("karar.aiAnalizError") });
      });

    return () => {
      cancelled = true;
    };
  }, [pair, direction, score, t]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("karar.aiAnalizModalTitle", { pair, direction })}
        className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-bg-card shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border/50 bg-bg-card px-4 py-3">
          <span className="font-mono text-sm font-bold text-text-t1 tracking-wider">
            {t("karar.aiAnalizModalTitle", { pair, direction })}
          </span>
          <button
            onClick={onClose}
            className="font-mono text-xs text-text-t4 transition-colors hover:text-text-t1"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3">
          {state.status === "loading" && (
            <div className="flex items-center justify-center py-10">
              <span className="font-mono text-xs text-text-t4 animate-pulse">
                {t("karar.aiAnalizLoading")}
              </span>
            </div>
          )}

          {state.status === "error" && (
            <div className="flex items-center justify-center py-10 px-2 text-center">
              <p className="font-mono text-xs text-red-400">{state.message}</p>
            </div>
          )}

          {state.status === "ready" && (
            <>
              {state.data.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={state.data.image}
                  alt={`${pair} ${direction} AI Analiz grafiği`}
                  className="w-full rounded border border-border"
                />
              ) : (
                <div className="flex items-center justify-center h-32 rounded border border-border bg-surface-s1">
                  <span className="font-mono text-2xs text-text-t4">{t("karar.aiAnalizImageMissing")}</span>
                </div>
              )}

              <p className="font-mono text-xs text-text-t1 leading-relaxed">
                {state.data.narrative ?? t("karar.aiAnalizNarrativeFallback")}
              </p>

              {state.data.humanCheck && (
                <div className="flex flex-col gap-1.5 rounded-lg px-3 py-2 panel-inset">
                  <div className="flex items-center justify-between font-mono text-2xs">
                    <span className="text-text-t4 tracking-wider uppercase">{t("karar.aiAnalizNumbersTitle")}</span>
                    <span className={state.data.humanCheck.approved ? "text-signal-up" : "text-signal-down"}>
                      {state.data.humanCheck.approved ? t("karar.aiAnalizApproved") : t("karar.aiAnalizRejected")}
                    </span>
                  </div>

                  {state.data.tradeLevels && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/40 pt-1.5 font-mono text-2xs tabular-nums">
                      <span className="text-text-t4">{t("karar.aiAnalizEntry")}</span>
                      <span className="text-right text-text-t1">{fmtPrice(state.data.tradeLevels.entry)}</span>
                      <span className="text-text-t4">{t("karar.aiAnalizStop")}</span>
                      <span className="text-right text-signal-down">{fmtPrice(state.data.tradeLevels.stopPrice)}</span>
                      <span className="text-text-t4">{t("karar.aiAnalizTp1")}</span>
                      <span className="text-right text-signal-up">{fmtPrice(state.data.tradeLevels.tp1Price)}</span>
                      <span className="text-text-t4">{t("karar.aiAnalizTp2")}</span>
                      <span className="text-right text-signal-up">{fmtPrice(state.data.tradeLevels.tp2Price)}</span>
                      <span className="text-text-t4">{t("karar.aiAnalizRR")}</span>
                      <span className="text-right text-text-t1">
                        {state.data.humanCheck.rrCheck.rr1 !== null ? state.data.humanCheck.rrCheck.rr1.toFixed(2) : "—"}
                      </span>
                      <span className="text-text-t4">{t("karar.aiAnalizVolRatio")}</span>
                      <span className="text-right text-text-t1">
                        {state.data.humanCheck.volumeCheck.volRatio !== null
                          ? `${state.data.humanCheck.volumeCheck.volRatio.toFixed(2)}x`
                          : "—"}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/40 pt-1.5 font-mono text-2xs tabular-nums">
                    <span className="text-text-t4">{t("karar.aiAnalizResistance")}</span>
                    <span className="text-right text-text-t1">
                      {fmtPrice(state.data.humanCheck.srCheck.nearestResistance?.price ?? null)}
                    </span>
                    <span className="text-text-t4">{t("karar.aiAnalizSupport")}</span>
                    <span className="text-right text-text-t1">
                      {fmtPrice(state.data.humanCheck.srCheck.nearestSupport?.price ?? null)}
                    </span>
                    <span className="text-text-t4">{t("karar.aiAnalizTrendLine")}</span>
                    <span className="text-right text-text-t1">
                      {state.data.humanCheck.trendLine === null
                        ? t("karar.aiAnalizTrendLineNone")
                        : state.data.humanCheck.trendLine.confirmed
                        ? t("karar.aiAnalizTrendLineConfirmed")
                        : t("karar.aiAnalizTrendLineUnconfirmed")}
                    </span>
                  </div>
                </div>
              )}

              <p className="font-mono text-2xs text-text-t4 opacity-60 text-center">
                {t("karar.aiAnalizDisclaimer")}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
