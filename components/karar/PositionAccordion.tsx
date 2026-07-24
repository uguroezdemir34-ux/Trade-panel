"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePositionStore } from "@/lib/store/positionStore";
import { useScoreStore } from "@/lib/store/scoreStore";
import { useFocusStore } from "@/lib/store/focusStore";
import { useT } from "@/lib/i18n/context";
import { AiCheckButton } from "./AiCheckButton";
import { isSupportedPair } from "@/lib/constants/pairs";

// lucide-react bu projede kurulu değil (package.json'da doğrulandı,
// npm install bu sandbox'ta engelli — CLAUDE.md §3) — lucide'ın
// "TrendingUp" ikonunun kendi SVG path'i (MIT lisanslı, herkese açık
// ikon şekli) birebir aynı görsel sonucu vermek için buraya inline
// kopyalandı, yeni bir bağımlılık eklenmedi.
function TrendingUpIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number, dec = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function signed(n: number, dec = 2): string {
  return (n >= 0 ? "+" : "") + n.toFixed(dec);
}
function fmtPx(n: number): string {
  if (n >= 10_000) return fmt(n, 1);
  if (n >= 100)    return fmt(n, 2);
  if (n >= 1)      return n.toFixed(4);
  return n.toFixed(6);
}
function safe(n: number): number { return isFinite(n) ? n : 0; }
function safeDiv(a: number, b: number): number {
  return b !== 0 && isFinite(b) ? safe(a / b) : 0;
}
function fmtDuration(openedAtMs: number, nowMs: number): string {
  const diffMin = Math.max(0, Math.floor((nowMs - openedAtMs) / 60_000));
  const days = Math.floor(diffMin / 1440);
  const hours = Math.floor((diffMin % 1440) / 60);
  const mins = diffMin % 60;
  if (days > 0) return `${days}g ${hours}s`;
  if (hours > 0) return `${hours}s ${mins}d`;
  return `${mins}d`;
}
/** R Multiple: mevcut kâr/zararın giriş-stop mesafesine oranı. SL yoksa null. */
function computeRMultiple(
  entryPx: number,
  markPx: number,
  slTriggerPx: number | null,
  direction: "LONG" | "SHORT" | "NEUTRAL",
): number | null {
  if (slTriggerPx === null || entryPx <= 0) return null;
  const riskDistance = Math.abs(entryPx - slTriggerPx);
  if (riskDistance <= 0) return null;
  const gainDistance = direction === "SHORT" ? entryPx - markPx : markPx - entryPx;
  return gainDistance / riskDistance;
}

// ─── Color tokens ─────────────────────────────────────────────────────────────
const EMERALD = "#10b981";
const CRIMSON = "#ef4444";
const AMBER   = "#f59e0b";
const GREY    = "#6b7280";

function qxScoreColor(score: number | null, posDir: "LONG" | "SHORT" | "NEUTRAL"): string {
  if (score === null) return GREY;
  if (posDir === "LONG") {
    if (score >= 55) return EMERALD;
    if (score >= 40) return AMBER;
    return CRIMSON;
  }
  if (posDir === "SHORT") {
    if (score <= 45) return EMERALD;
    if (score <= 60) return AMBER;
    return CRIMSON;
  }
  if (score >= 55) return EMERALD;
  if (score >= 40) return AMBER;
  return CRIMSON;
}

function QxScoreBadge({ pair, posDir }: { pair: string; posDir: "LONG" | "SHORT" | "NEUTRAL" }) {
  const t = useT();
  const scored = isSupportedPair(pair);
  const result = useScoreStore((s) => s.results[pair]);
  const score  = result?.score ?? null;
  const color  = scored ? qxScoreColor(score, posDir) : GREY;
  return (
    <div
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono shrink-0"
      style={{ border: `1px solid ${color}38`, background: `${color}0e` }}
      title={scored ? undefined : t("position.notScored")}
    >
      <span className="text-[9px] font-bold tracking-widest" style={{ color }}>QX</span>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
        {!scored ? "N/A" : score !== null ? Math.round(score) : "—"}
      </span>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: color, boxShadow: `0 0 4px 1px ${color}80` }}
      />
    </div>
  );
}

// ─── PositionAccordion ────────────────────────────────────────────────────────
export function PositionAccordion(): React.ReactElement | null {
  const t = useT();
  const router = useRouter();
  const openPositions = usePositionStore((s) => s.positions);
  const setFocus = useFocusStore((s) => s.setFocus);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (openPositions.length === 0) return null;

  const openUpl = openPositions.reduce((sum, p) => sum + safe(p.upl), 0);

  function toggle(instId: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(instId)) next.delete(instId);
      else next.add(instId);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface-s1 overflow-hidden">

      {/* ── Header: pozisyon sayısı + toplam UPL + portfolyo linki ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <span className="font-mono text-2xs text-text-t3 uppercase tracking-wider">
          {openPositions.length} Açık Pozisyon
        </span>
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-xs font-semibold tabular-nums"
            style={{ color: openUpl >= 0 ? EMERALD : CRIMSON }}
          >
            {`UPL ${openUpl >= 0 ? "+" : ""}${openUpl.toFixed(0)}$`}
          </span>
          <Link
            href="/portfolyo"
            className="text-text-t4 hover:text-text-t2 transition-colors font-mono text-sm leading-none"
            aria-label="Portfolyo"
          >
            →
          </Link>
        </div>
      </div>

      {/* ── Per-position rows ── */}
      {openPositions.map((pos) => {
        const isLong   = pos.direction === "LONG";
        const dirColor = isLong ? EMERALD : CRIMSON;
        const uplSafe  = safe(pos.upl);
        const roePct   = safe(pos.uplRatio) * 100;
        const pnlColor = uplSafe >= 0 ? EMERALD : CRIMSON;
        const margin   = safeDiv(pos.notional, pos.leverage > 0 ? pos.leverage : 1);
        const isOpen   = expanded.has(pos.instId);

        return (
          <div key={pos.instId} className="border-t border-border/40">

            {/* Summary row — always visible, click to toggle */}
            <button
              onClick={() => toggle(pos.instId)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-s2 transition-colors text-left"
            >
              <span className="font-mono text-sm font-bold text-text-t1 w-10 shrink-0">
                {pos.pair}
              </span>

              <div
                className="inline-flex items-center gap-1 font-mono text-2xs font-bold px-1.5 py-0.5 rounded-md shrink-0"
                style={{ color: dirColor, background: `${dirColor}16`, border: `1px solid ${dirColor}40` }}
              >
                <span>{isLong ? "▲ L" : "▼ S"}</span>
                <span style={{ opacity: 0.45 }}>·</span>
                <span>{pos.leverage}x</span>
              </div>

              <QxScoreBadge pair={pos.pair} posDir={pos.direction} />

              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <span
                  className={`font-mono text-base font-bold tabular-nums ${uplSafe >= 0 ? "pnl-breathe-green" : "pnl-breathe-red"}`}
                  style={{ color: pnlColor }}
                >
                  {`${uplSafe >= 0 ? "+" : ""}${uplSafe.toFixed(0)}$`}
                </span>
                <span className="font-mono text-sm tabular-nums" style={{ color: pnlColor }}>
                  {signed(roePct)}%
                </span>
              </div>

              {/* Grafiğe git — sadece skorlanan (PAIRS'te olan) paritelerde
                  anlamlı: /grafik candle/skor verisini sadece PAIRS için
                  çekiyor, desteklenmeyen bir pariteye yönlendirmek boş bir
                  grafik açardı. */}
              {(() => {
                if (!isSupportedPair(pos.pair)) return null;
                const chartPair = pos.pair;
                return (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocus(chartPair);
                      router.push("/grafik");
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.stopPropagation();
                      e.preventDefault();
                      setFocus(chartPair);
                      router.push("/grafik");
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-2xs font-semibold text-emerald-400 ml-1 shrink-0 transition-colors hover:bg-emerald-500/20 hover:border-emerald-500/50 active:bg-emerald-500/25"
                    title={t("position.goToChart")}
                    aria-label={t("position.goToChart")}
                  >
                    <TrendingUpIcon className="h-3 w-3 shrink-0" />
                    {t("position.goToChart")}
                  </span>
                );
              })()}

              <span
                className="font-mono text-base text-text-t4 ml-1 shrink-0 transition-transform duration-200"
                style={{ display: "inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                aria-hidden
              >
                ›
              </span>
            </button>

            {/* Expanded detail grid */}
            {isOpen && (
              <div
                className="px-3 pb-3 border-t border-border/20"
                style={{ background: `linear-gradient(150deg, ${dirColor}09 0%, transparent 62%)` }}
              >
                <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 pt-2.5">

                  {/* Satır 1: Pozisyon Büyüklüğü / Kullanılan Teminat / Likidasyon */}
                  <div>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("portfolio.wallet.posSize")}
                    </div>
                    <div className="font-mono text-xs font-semibold text-text-t1 tabular-nums">
                      ${fmt(pos.notional, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("portfolio.wallet.usedMargin")}
                    </div>
                    <div className="font-mono text-xs font-semibold text-text-t1 tabular-nums">
                      ${fmt(margin, 0)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("portfolio.wallet.liqPriceLabel")}
                    </div>
                    <div
                      className="font-mono text-xs font-semibold tabular-nums"
                      style={{ color: pos.liqPx ? CRIMSON : undefined }}
                    >
                      {pos.liqPx ? `$${fmtPx(pos.liqPx)}` : "—"}
                    </div>
                  </div>

                  {/* Satır 2: Giriş / Mark / ROE */}
                  <div>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("position.entry")}
                    </div>
                    <div className="font-mono text-xs text-text-t1 tabular-nums">
                      ${fmtPx(pos.entryPx)}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("position.mark")}
                    </div>
                    <div className="font-mono text-xs text-text-t1 tabular-nums">
                      ${fmtPx(pos.markPx)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("position.roe")}
                    </div>
                    <div className="font-mono text-xs font-semibold tabular-nums" style={{ color: pnlColor }}>
                      {signed(roePct)}%
                    </div>
                  </div>

                  {/* Satır 3: TP / SL */}
                  <div title={t("position.tp")}>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("position.takeProfit")}
                    </div>
                    {pos.tpTriggerPx !== null && pos.entryPx > 0 ? (
                      <>
                        <div className="font-mono text-xs font-semibold tabular-nums" style={{ color: EMERALD }}>
                          ${fmtPx(pos.tpTriggerPx)}
                        </div>
                        <div className="font-mono text-2xs tabular-nums text-text-t4">
                          {signed(safeDiv(pos.tpTriggerPx - pos.entryPx, pos.entryPx) * 100)}%
                        </div>
                        {pos.markPx > 0 && (
                          <div className="font-mono text-2xs tabular-nums text-text-t3" title={t("position.distanceToTp")}>
                            {signed(safeDiv(pos.tpTriggerPx - pos.markPx, pos.markPx) * 100)}% ({t("position.distanceToTp")})
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="font-mono text-xs text-text-t3">—</div>
                    )}
                  </div>
                  <div title={t("position.sl")}>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("position.stopLoss")}
                    </div>
                    {pos.slTriggerPx !== null && pos.entryPx > 0 ? (
                      <>
                        <div className="font-mono text-xs font-semibold tabular-nums" style={{ color: CRIMSON }}>
                          ${fmtPx(pos.slTriggerPx)}
                        </div>
                        <div className="font-mono text-2xs tabular-nums text-text-t4">
                          {signed(safeDiv(pos.slTriggerPx - pos.entryPx, pos.entryPx) * 100)}%
                        </div>
                        {pos.markPx > 0 && (
                          <div className="font-mono text-2xs tabular-nums text-text-t3" title={t("position.distanceToSl")}>
                            {signed(safeDiv(pos.slTriggerPx - pos.markPx, pos.markPx) * 100)}% ({t("position.distanceToSl")})
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="font-mono text-xs text-text-t3">—</div>
                    )}
                  </div>
                  <div /> {/* 3. kolon boş — simetri */}

                  {/* Satır 4: R Multiple / Süre */}
                  <div>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("position.rMultiple")}
                    </div>
                    {(() => {
                      const r = computeRMultiple(pos.entryPx, pos.markPx, pos.slTriggerPx, pos.direction);
                      return r === null ? (
                        <div className="font-mono text-xs text-text-t3">—</div>
                      ) : (
                        <div className="font-mono text-xs font-semibold tabular-nums" style={{ color: r >= 0 ? EMERALD : CRIMSON }}>
                          {signed(r)}R
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <div className="font-mono text-2xs text-text-t4 tracking-wider uppercase mb-0.5">
                      {t("position.duration")}
                    </div>
                    <div className="font-mono text-xs text-text-t1 tabular-nums">
                      {pos.cTime > 0 ? fmtDuration(pos.cTime, Date.now()) : "—"}
                    </div>
                  </div>
                  <div /> {/* 3. kolon boş — simetri */}

                </div>

                <AiCheckButton position={pos} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
