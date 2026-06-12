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
import { computeAllSignals } from "@/lib/server/signalEngine";
import { loadTelegramConfigFromEnv } from "@/lib/notify/telegram/config";
import { sendTelegramMessage } from "@/lib/notify/telegram/client";
import { escapeMarkdownV2, bold } from "@/lib/notify/telegram/escape";

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

  const elapsedMs = Date.now() - startMs;

  console.log(
    `[CRON signal-check] ${signals.length} pairs checked, ${newSignals.length} new GO signals,` +
      ` ${telegramSent} sent, ${errors.length} errors, ${elapsedMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    checkedPairs: signals.length,
    goSignals: signals.filter((s) => s.verdict === "go").length,
    newSignals: newSignals.length,
    telegramSent,
    telegramFailed,
    errors: errors.map((e) => ({ pair: e.pair, error: e.error })),
    elapsedMs,
  });
}
