import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Layer 1: server-side env vars (highest priority)
  let token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  let chatId = process.env.TELEGRAM_VIP_CHAT_ID?.trim();

  // Layer 2: client-provided credentials from request body
  try {
    const body = (await req.json()) as { botToken?: string; chatId?: string };
    if (!token && body.botToken) token = body.botToken.trim();
    if (!chatId && body.chatId) chatId = body.chatId.trim();
  } catch {
    // Body may be absent or empty — ignore
  }

  if (!token || !chatId) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "✅ Quantix bot connection working." }),
      },
    );

    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      error_code?: number;
    };

    if (!data.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data.description ?? "Telegram API error",
          errorCode: data.error_code,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Network error reaching Telegram API" },
      { status: 502 },
    );
  }
}
