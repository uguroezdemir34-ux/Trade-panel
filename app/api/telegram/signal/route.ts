import { NextRequest, NextResponse } from "next/server";
import { formatNotifyMessage } from "@/lib/notify/telegram/formatter";
import type { NotifyMessage } from "@/lib/notify/types";

export const dynamic = 'force-dynamic';

interface SignalBody {
  msg: NotifyMessage;
  /** Layer 2: browser-stored credentials (fallback when env vars absent) */
  botToken?: string;
  chatId?: string;
}

export async function POST(req: NextRequest) {
  // Layer 1: server-side env vars (highest priority)
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_VIP_CHAT_ID;

  let body: SignalBody;
  try {
    body = (await req.json()) as SignalBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // Layer 2: client-provided credentials
  if (!token && body.botToken) token = body.botToken;
  if (!chatId && body.chatId) chatId = body.chatId;

  if (!token || !chatId) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 400 });
  }

  let text: string;
  try {
    text = formatNotifyMessage(body.msg);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `format_error: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 400 },
    );
  }

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
