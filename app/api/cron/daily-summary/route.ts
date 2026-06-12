/**
 * CRON: DAILY SUMMARY — /api/cron/daily-summary
 *
 * Schedule: midnight UTC daily (vercel.json: "0 0 * * *")
 * Auth: CRON_SECRET (Vercel auto-set)
 *
 * Sends a daily market snapshot to Telegram:
 *   - Active GO signals with 24h price change
 *   - High-score WAIT pairs
 *   - Dominant direction stat
 *
 * No browser required — fully server-side.
 */

import { NextResponse } from "next/server";
import { PAIRS } from "@/lib/constants/pairs";
import { computeAllSignals, fetch24hTickers } from "@/lib/server/signalEngine";
import { loadTelegramConfigFromEnv } from "@/lib/notify/telegram/config";
import { sendTelegramMessage } from "@/lib/notify/telegram/client";
import { escapeMarkdownV2, bold } from "@/lib/notify/telegram/escape";
import type { ServerSignalResult } from "@/lib/server/signalEngine";

export const dynamic = 'force-dynamic';

export const runtime = "nodejs";
export const maxDuration = 10;

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const MONTH_NAMES = [
  "Oca","Şub","Mar","Nis","May","Haz",
  "Tem","Ağu","Eyl","Eki","Kas","Ara",
];

function formatDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function pctStr(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function buildSummaryMessage(
  signals: ServerSignalResult[],
  tickers: Map<string, { last: number; chg24hPct: number }>,
  now: Date,
): string {
  const goSignals = signals.filter((s) => s.verdict === "go");
  const highScore = signals.filter((s) => s.verdict !== "go" && s.score >= 70);
  const longs = goSignals.filter((s) => s.direction === "LONG");
  const shorts = goSignals.filter((s) => s.direction === "SHORT");

  const lines: string[] = [
    `📊 ${bold("QUANTIX OS — Günlük Özet")}`,
    escapeMarkdownV2(`📅 ${formatDate(now)}, 00:00 UTC`),
    "",
  ];

  if (goSignals.length === 0) {
    lines.push(escapeMarkdownV2("⚫ Aktif GO sinyali yok"));
  } else {
    lines.push(
      `🟢 ${bold(`GO SİNYALLER (${goSignals.length}/15)`)}`,
    );
    for (const s of goSignals) {
      const ticker = tickers.get(s.pair);
      const dirEmoji = s.direction === "LONG" ? "▲" : "▼";
      const chgStr = ticker ? ` ${escapeMarkdownV2(pctStr(ticker.chg24hPct))} 24h` : "";
      const priceStr = ticker ? ` · ${escapeMarkdownV2(formatPrice(ticker.last))}` : "";
      lines.push(
        `• ${dirEmoji} ${bold(s.pair)} — ${escapeMarkdownV2(`Score: ${s.score}`)}${priceStr}${chgStr}`,
      );
    }
  }

  if (highScore.length > 0) {
    lines.push("");
    lines.push(escapeMarkdownV2(`⚡ Yüksek Skor WAIT (${highScore.length}):`));
    const topFive = highScore.sort((a, b) => b.score - a.score).slice(0, 5);
    for (const s of topFive) {
      const ticker = tickers.get(s.pair);
      const chgStr = ticker ? ` ${escapeMarkdownV2(pctStr(ticker.chg24hPct))}` : "";
      lines.push(
        `• ${escapeMarkdownV2(s.pair)} — ${escapeMarkdownV2(`Score: ${s.score}`)}${chgStr}`,
      );
    }
    if (highScore.length > 5) {
      lines.push(escapeMarkdownV2(`  … +${highScore.length - 5} more`));
    }
  }

  lines.push("");
  lines.push(
    escapeMarkdownV2(
      `📈 Yön: LONG ${longs.length} · SHORT ${shorts.length} · ${15 - goSignals.length} WAIT`,
    ),
  );

  lines.push("");
  lines.push(escapeMarkdownV2("🤖 Otomatik günlük özet — sunucu taraflı"));

  return lines.join("\n");
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();
  const now = new Date();

  const [signals, tickers] = await Promise.all([
    computeAllSignals(PAIRS),
    fetch24hTickers(PAIRS),
  ]);

  const telegramConfig = loadTelegramConfigFromEnv();
  let telegramResult: { ok: boolean; error?: string } = { ok: false, error: "not_configured" };

  if (telegramConfig) {
    const text = buildSummaryMessage(signals, tickers, now);
    const result = await sendTelegramMessage(telegramConfig, { text });
    telegramResult = result.ok
      ? { ok: true }
      : { ok: false, error: result.errorMessage ?? result.errorKind };
  }

  console.log(
    `[CRON daily-summary] ${signals.length} pairs, ` +
      `${signals.filter((s) => s.verdict === "go").length} GO, ` +
      `telegram=${telegramResult.ok}, ${Date.now() - startMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    date: now.toISOString(),
    pairs: signals.length,
    goCount: signals.filter((s) => s.verdict === "go").length,
    telegram: telegramResult,
    elapsedMs: Date.now() - startMs,
  });
}
