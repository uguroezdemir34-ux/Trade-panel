/**
 * CRON: HOURLY SIGNAL CHECK — /api/cron/signal-check
 *
 * Schedule: every hour (vercel.json: "0 * * * *")
 * Auth: CRON_SECRET (set automatically by Vercel in env)
 *
 * Logic (stateless deduplication):
 *   For each of 15 pairs: compute score for last closed bar.
 *   Compare with second-to-last bar score.
 *   If current=GO and previous≠GO → new signal transition → send Telegram.
 *
 * This means: signal fires once per GO transition even when browser is closed.
 * If browser is also open and sends the signal, user gets a duplicate — the
 * server message is tagged [SERVER] so it's distinguishable.
 *
 * Vercel plan requirement:
 *   Hobby:  2 crons/project, 10s max duration (30 pairs × ~200ms = ~6s → fits)
 *   Pro:    unlimited crons, 60s max duration
 */

import { NextResponse } from "next/server";
import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";
import { computeAllSignals, fetch24hTickers } from "@/lib/server/signalEngine";
import { loadTelegramConfigFromEnv } from "@/lib/notify/telegram/config";
import { sendTelegramMessage } from "@/lib/notify/telegram/client";
import { escapeMarkdownV2, bold } from "@/lib/notify/telegram/escape";
import {
  insertGoSignal,
  getSignalsPendingOutcome,
  writeSignalOutcome,
  type OutcomeField,
  type PendingOutcomeSignal,
} from "@/lib/db/goSignals";
import { insertScoreHistoryBatch, type ScoreHistoryInput } from "@/lib/db/scoreHistory";
import { directionalMovePct, isAdverseMove } from "@/lib/signals/outcomeTracking";

export const runtime = "nodejs";
export const maxDuration = 10;

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // allow in dev
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function formatPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`; // SHIB/FET gibi çok küçük fiyatlar için
}

// Sunucu tarafı outcome penceresi — client'taki dar pencereden (15-20dk,
// 60-65dk) KASITLI OLARAK daha geniş: bu cron saatte bir çalışıyor (2-cron
// Hobby plan limiti nedeniyle ayrı, sık çalışan bir cron eklenmedi —
// kullanıcı onayıyla). Bkz. lib/db/goSignals.ts + supabase/migrations/008.
const OUTCOME_15M_MIN_MS = 15 * 60_000;
const OUTCOME_15M_MAX_MS = 75 * 60_000;
const OUTCOME_1H_MIN_MS = 60 * 60_000;
const OUTCOME_1H_MAX_MS = 120 * 60_000;

/** Bekleyen sinyal listesini tickers Map'iyle işler, yazılan kayıt sayısını döner. */
async function processOutcomeBatch(
  pending: PendingOutcomeSignal[],
  field: OutcomeField,
  tickers: Map<Pair, { last: number; chg24hPct: number }>,
  nowMs: number,
): Promise<number> {
  let written = 0;
  for (const sig of pending) {
    // sig.pair DB'den geliyor (string) ama go_signals'a sadece bu sistemin
    // kendisi PAIRS listesinden yazıyor — Pair union'ına daraltmak güvenli.
    const currentPrice = tickers.get(sig.pair as Pair)?.last;
    if (!currentPrice || currentPrice <= 0 || sig.triggerPrice <= 0) continue;
    try {
      const movePct = ((currentPrice - sig.triggerPrice) / sig.triggerPrice) * 100;
      const movePctDir = directionalMovePct(sig.triggerPrice, currentPrice, sig.direction);
      await writeSignalOutcome(sig.id, field, {
        movePct,
        price: currentPrice,
        isAdverse: isAdverseMove(movePctDir),
        capturedAtMs: nowMs,
      });
      written++;
    } catch (err) {
      console.error(`[CRON signal-check] outcome${field} write failed for ${sig.id}:`, err);
    }
  }
  return written;
}

function buildSignalMessage(
  pair: string,
  direction: string,
  score: number,
  price: number,
): string {
  const dirEmoji = direction === "LONG" ? "▲" : direction === "SHORT" ? "▼" : "◆";
  const lines: string[] = [
    `⚡ ${bold("QUANTIX SERVER SIGNAL")}`,
    "",
    `${dirEmoji} ${bold(pair)} ${escapeMarkdownV2(direction)} ${escapeMarkdownV2("@ " + formatPrice(price))}`,
    escapeMarkdownV2(`Score: ${score}/100`),
    "",
    escapeMarkdownV2("🤖 Sunucu tarafı sinyal — browser kapalıyken gönderildi"),
    `\\#${escapeMarkdownV2(pair)} \\#${escapeMarkdownV2(direction)} \\#SERVER`,
  ];
  return lines.join("\n");
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "true";

  const startMs = Date.now();

  const signals = await computeAllSignals(PAIRS);

  const newSignals = signals.filter((s) => s.isNewSignal);
  const errors = signals.filter((s) => s.error);

  let telegramSent = 0;
  let telegramFailed = 0;

  const telegramConfig = loadTelegramConfigFromEnv();

  for (const sig of newSignals) {
    if (!telegramConfig) break;

    const text = buildSignalMessage(sig.pair, sig.direction, sig.score, sig.price);
    const result = await sendTelegramMessage(telegramConfig, { text });

    if (result.ok) {
      telegramSent++;
    } else {
      telegramFailed++;
      console.error(`[CRON signal-check] Telegram failed for ${sig.pair}:`, result.errorMessage);
    }
  }

  // ── DB write: persist new GO signals (non-fatal — cron continues on error) ──
  let dbWritten = 0;
  for (const sig of newSignals) {
    try {
      await insertGoSignal({
        pair: sig.pair,
        direction: sig.direction,
        score: sig.score,
        effectiveThreshold: sig.effectiveThreshold,
        triggerPrice: sig.price,
        signalTs: sig.signalTs ?? startMs,
        pullbackActive: sig.pullbackActive ?? false,
        regime: sig.regime,
        sweepBonus: sig.sweepBonus ?? 0,
        regimeBonus: sig.regimeBonus ?? 0,
        blocks: sig.blocks ?? [],
        softBlocks: sig.softBlocks ?? [],
        sub: sig.sub,
      });
      dbWritten++;
    } catch (err) {
      console.error(`[CRON signal-check] DB write failed for ${sig.pair}:`, err);
    }
  }

  // ── DB write: persist a raw score snapshot for EVERY pair, GO/WAIT/NO
  // fark etmeksizin (go_signals'ın aksine — o sadece GO geçişlerini tutar).
  // Skor hesaplama mantığına dokunulmuyor, `signals` zaten computeAllSignals()
  // tarafından hesaplanmış — burada sadece o mevcut sonuç ek olarak
  // score_history'ye yazılıyor. Hata durumlarını (sig.error) atlıyoruz —
  // onlarda sub/regime/baseScore hiç yok (computeServerSignal'ın catch
  // dalı sadece pair/verdict/direction/score/price döner, bkz. signalEngine.ts).
  // Tek Supabase isteği (batch upsert) — ~9 pair için loop yerine tek
  // POST, 10sn cron bütçesini (Hobby plan) gereksiz zorlamaz.
  let scoreHistoryWritten = 0;
  try {
    const historyRows: ScoreHistoryInput[] = signals
      .filter((s) => !s.error && s.sub !== undefined && s.baseScore !== undefined)
      .map((s) => ({
        pair: s.pair,
        direction: s.direction,
        verdict: s.verdict,
        score: s.score,
        baseScore: s.baseScore as number,
        effectiveThreshold: s.effectiveThreshold,
        price: s.price,
        signalTs: s.signalTs ?? startMs,
        regime: s.regime,
        sweepBonus: s.sweepBonus ?? 0,
        regimeBonus: s.regimeBonus ?? 0,
        overextFlags: s.overextFlags ?? 0,
        srModifierRaw: s.srModifierRaw,
        srModifierApplied: s.srModifierApplied,
        blocks: s.blocks ?? [],
        softBlocks: s.softBlocks ?? [],
        sub: s.sub,
      }));
    await insertScoreHistoryBatch(historyRows);
    scoreHistoryWritten = historyRows.length;
  } catch (err) {
    console.error(`[CRON signal-check] score_history write failed:`, err);
  }

  // ── Outcome check: fill in outcome15m/outcome1h for past signals ──
  // (non-fatal — whole block wrapped so a Supabase hiccup never fails the
  // Telegram/score-check work above, which already completed by this point)
  let outcomesWritten = 0;
  try {
    const [pending15m, pending1h] = await Promise.all([
      getSignalsPendingOutcome("15m", startMs, OUTCOME_15M_MIN_MS, OUTCOME_15M_MAX_MS),
      getSignalsPendingOutcome("1h", startMs, OUTCOME_1H_MIN_MS, OUTCOME_1H_MAX_MS),
    ]);

    if (pending15m.length > 0 || pending1h.length > 0) {
      const tickers = await fetch24hTickers(PAIRS);
      outcomesWritten += await processOutcomeBatch(pending15m, "15m", tickers, startMs);
      outcomesWritten += await processOutcomeBatch(pending1h, "1h", tickers, startMs);
    }
  } catch (err) {
    console.error(`[CRON signal-check] outcome check failed:`, err);
  }

  const elapsedMs = Date.now() - startMs;

  console.log(
    `[CRON signal-check] ${signals.length} pairs checked, ${newSignals.length} new GO signals,` +
      ` ${telegramSent} sent, ${dbWritten} db written, ${scoreHistoryWritten} score_history written,` +
      ` ${outcomesWritten} outcomes written, ${errors.length} errors, ${elapsedMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    checkedPairs: signals.length,
    goSignals: signals.filter((s) => s.verdict === "go").length,
    newSignals: newSignals.length,
    telegramSent,
    telegramFailed,
    dbWritten,
    scoreHistoryWritten,
    outcomesWritten,
    errors: errors.map((e) => ({ pair: e.pair, error: e.error })),
    elapsedMs,
    ...(verbose && {
      allScores: signals.map((s) => ({
        pair: s.pair,
        verdict: s.verdict,
        score: s.score,
        direction: s.direction,
        price: s.price,
        isNewSignal: s.isNewSignal,
        ...s.debugInputs,
      })),
    }),
  });
}
