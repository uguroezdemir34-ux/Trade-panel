import { NextRequest, NextResponse } from "next/server";
import { escapeMarkdownV2, bold } from "@/lib/notify/telegram/escape";

export const dynamic = 'force-dynamic';

/**
 * TRADINGVIEW WEBHOOK — Receives TradingView alerts and forwards to Telegram.
 *
 * TradingView alert JSON body (all fields optional except ticker + action):
 *   { ticker, action, close, high, low, volume, time, message }
 *
 * Optional secret protection: set TV_WEBHOOK_SECRET env var.
 * TradingView alert URL: https://your-domain/api/webhook/tv?secret=YOUR_SECRET
 *
 * No auto-trading — notification only.
 */

interface TvPayload {
  ticker?: string;
  action?: string;
  close?: string | number;
  high?: string | number;
  low?: string | number;
  volume?: string | number;
  time?: string;
  message?: string;
}

function formatTvAlert(payload: TvPayload): string {
  const ticker = payload.ticker ?? "UNKNOWN";
  const action = (payload.action ?? "alert").toUpperCase();

  const actionEmoji =
    action === "BUY" || action === "LONG" ? "▲"
    : action === "SELL" || action === "SHORT" ? "▼"
    : action === "CLOSE_LONG" || action === "CLOSE_SHORT" ? "✕"
    : "📡";

  const lines: string[] = [];
  lines.push(`📡 ${bold("TRADINGVIEW UYARISI")}`);
  lines.push("");
  lines.push(`${actionEmoji} ${bold(escapeMarkdownV2(ticker))} — ${escapeMarkdownV2(action)}`);

  if (payload.close !== undefined) {
    lines.push(`Fiyat: \`${escapeMarkdownV2(String(payload.close))}\``);
  }
  if (payload.high !== undefined && payload.low !== undefined) {
    lines.push(`H/L: \`${escapeMarkdownV2(String(payload.high))} / ${escapeMarkdownV2(String(payload.low))}\``);
  }
  if (payload.volume !== undefined) {
    lines.push(`Hacim: \`${escapeMarkdownV2(String(payload.volume))}\``);
  }
  if (payload.message) {
    lines.push("");
    lines.push(escapeMarkdownV2(payload.message));
  }
  if (payload.time) {
    const ts = new Date(payload.time).toLocaleString("tr-TR", { timeZone: "UTC" });
    lines.push("");
    lines.push(`_${escapeMarkdownV2(ts)} UTC_`);
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  // Optional secret check
  const envSecret = process.env.TV_WEBHOOK_SECRET;
  if (envSecret) {
    const qSecret = req.nextUrl.searchParams.get("secret");
    if (qSecret !== envSecret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_VIP_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json({ ok: false, error: "telegram_not_configured" }, { status: 400 });
  }

  let payload: TvPayload;
  try {
    const body = await req.text();
    // TradingView can send plain text or JSON
    try {
      payload = JSON.parse(body) as TvPayload;
    } catch {
      // Plain text fallback — treat as message
      payload = { message: body };
    }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const text = formatTvAlert(payload);

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    },
  );

  const data = (await tgRes.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    return NextResponse.json(
      { ok: false, error: data.description ?? "telegram_api_error" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
