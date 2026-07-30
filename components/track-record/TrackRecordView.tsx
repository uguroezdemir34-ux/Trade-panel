"use client";

/**
 * TRACK RECORD VIEW — /track-record sayfasının render mantığı.
 *
 * Server component (app/track-record/page.tsx) tüm veriyi tek seferde
 * fetch eder, buraya prop olarak geçer. Parite filtresi SADECE tabloyu
 * etkiler — üstteki 4 özet kartı her zaman API'nin kendi `summary`
 * alanından, TÜM veri üzerinden hesaplanmış global rakamları gösterir
 * (görev tanımındaki sıralama: önce global özet, sonra filtre, sonra
 * filtrelenmiş tablo).
 *
 * Kayıp sinyaller ASLA gizlenmez/filtrelenmez (CLAUDE.md ilkesi + görev
 * tanımı madde 5) — pair filtresi dışında hiçbir varsayılan filtre yok.
 */

import { useMemo, useState } from "react";
import { useT, useLocale } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/types";
import { PAIRS } from "@/lib/constants/pairs";
import type { TrackRecordResponse, PublicSignalRecord } from "@/lib/track-record/types";

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  tr: "tr-TR",
  de: "de-DE",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ru: "ru-RU",
};

function formatDate(ts: number, locale: Locale): string {
  return new Date(ts).toLocaleString(LOCALE_TAGS[locale], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function winRateColor(rate: number): string {
  if (rate >= 0.6) return "text-green-400";
  if (rate >= 0.5) return "text-yellow-400";
  return "text-red-400";
}

interface OutcomeCellProps {
  movePct: number | null;
  isAdverse: boolean | null;
  pendingLabel: string;
}

function OutcomeCell({ movePct, isAdverse, pendingLabel }: OutcomeCellProps): React.ReactElement {
  if (movePct === null || isAdverse === null) {
    return <span className="font-mono text-2xs text-text-t4">{pendingLabel}</span>;
  }
  const color = isAdverse ? "text-signal-red" : "text-signal-green";
  return (
    <span className={`font-mono text-xs font-medium tabular-nums ${color}`}>
      {formatPct(movePct)}
    </span>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  valueClassName?: string;
  note?: string;
}

function SummaryCard({ label, value, valueClassName, note }: SummaryCardProps): React.ReactElement {
  return (
    <div className="border-border bg-bg-card rounded-md border p-3">
      <div className="text-text-t3 font-mono text-2xs tracking-wider">{label}</div>
      <div className={`font-mono text-lg font-bold tabular-nums ${valueClassName ?? "text-text-t1"}`}>
        {value}
      </div>
      {note && <div className="text-text-t4 font-mono text-2xs mt-0.5">{note}</div>}
    </div>
  );
}

interface Props {
  data: TrackRecordResponse | null;
}

export function TrackRecordView({ data }: Props): React.ReactElement {
  const t = useT();
  const locale = useLocale();
  const [pairFilter, setPairFilter] = useState<string>("ALL");

  const filteredSignals = useMemo<PublicSignalRecord[]>(() => {
    if (!data) return [];
    if (pairFilter === "ALL") return data.signals;
    return data.signals.filter((s) => s.pair === pairFilter);
  }, [data, pairFilter]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div>
        <h1 className="text-text-t1 text-lg font-bold">{t("trackRecord.pageTitle")}</h1>
        <p className="text-text-t3 mt-1 text-xs">{t("trackRecord.pageSubtitle")}</p>
        <p className="text-text-t4 font-mono text-2xs mt-1">{t("trackRecord.disclaimer")}</p>
      </div>

      {!data ? (
        <div className="border-border bg-bg-card rounded-lg border p-6 text-center">
          <p className="text-text-t3 font-mono text-xs">{t("trackRecord.loadError")}</p>
        </div>
      ) : (
        <>
          {/* Summary cards — always global, unaffected by pair filter */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard
              label={t("trackRecord.summary.totalSignals")}
              value={data.summary.total_signals.toLocaleString()}
            />
            <SummaryCard
              label={t("trackRecord.summary.winRate15m")}
              value={`${(data.summary.win_rate_15m * 100).toFixed(0)}%`}
              valueClassName={winRateColor(data.summary.win_rate_15m)}
            />
            <SummaryCard
              label={t("trackRecord.summary.winRate1h")}
              value={`${(data.summary.win_rate_1h * 100).toFixed(0)}%`}
              valueClassName={winRateColor(data.summary.win_rate_1h)}
            />
            <SummaryCard
              label={t("trackRecord.summary.avgMove")}
              value={formatPct(data.summary.avg_move_pct_1h)}
              valueClassName={
                data.summary.avg_move_pct_1h > 0
                  ? "text-signal-green"
                  : data.summary.avg_move_pct_1h < 0
                    ? "text-signal-red"
                    : "text-text-t2"
              }
              note={t("trackRecord.summary.avgMoveNote")}
            />
          </div>

          {/* Pair filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setPairFilter("ALL")}
              className={`rounded px-2.5 py-1 font-mono text-xs tracking-wider transition-colors ${
                pairFilter === "ALL"
                  ? "bg-surface-s2 text-text-t1"
                  : "text-text-t3 hover:text-text-t2"
              }`}
            >
              {t("trackRecord.filter.all")}
            </button>
            {PAIRS.map((p) => (
              <button
                key={p}
                onClick={() => setPairFilter(p)}
                className={`rounded px-2.5 py-1 font-mono text-xs tracking-wider transition-colors ${
                  pairFilter === p
                    ? "bg-surface-s2 text-text-t1"
                    : "text-text-t3 hover:text-text-t2"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="border-border bg-bg-card rounded-lg border overflow-hidden">
            {filteredSignals.length === 0 ? (
              <p className="px-4 py-6 text-center font-mono text-xs text-text-t4">
                {t("trackRecord.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border/20 bg-surface-s1/30">
                      <th className="whitespace-nowrap px-3 py-1.5 text-left font-mono text-2xs font-normal text-text-t4">
                        {t("trackRecord.table.colDate")}
                      </th>
                      <th className="whitespace-nowrap px-3 py-1.5 text-left font-mono text-2xs font-normal text-text-t4">
                        {t("trackRecord.table.colPair")}
                      </th>
                      <th className="whitespace-nowrap px-3 py-1.5 text-left font-mono text-2xs font-normal text-text-t4">
                        {t("trackRecord.table.colDirection")}
                      </th>
                      <th className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-2xs font-normal text-text-t4">
                        {t("trackRecord.table.col15m")}
                      </th>
                      <th className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-2xs font-normal text-text-t4">
                        {t("trackRecord.table.col1h")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.map((s) => (
                      <tr key={s.id} className="border-b border-border/30 last:border-0 hover:bg-surface-s1">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-2xs text-text-t3">
                          {formatDate(s.signal_ts, locale)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium text-text-t1">
                          {s.pair}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-2xs ${
                              s.direction === "LONG"
                                ? "bg-signal-green/10 text-signal-green"
                                : "bg-signal-red/10 text-signal-red"
                            }`}
                          >
                            {s.direction}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <OutcomeCell
                            movePct={s.outcome_15m_move_pct}
                            isAdverse={s.outcome_15m_is_adverse}
                            pendingLabel={t("trackRecord.table.pending")}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <OutcomeCell
                            movePct={s.outcome_1h_move_pct}
                            isAdverse={s.outcome_1h_is_adverse}
                            pendingLabel={t("trackRecord.table.pending")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
