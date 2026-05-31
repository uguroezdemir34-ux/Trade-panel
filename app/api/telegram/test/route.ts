import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Layer 1: server-side env vars (highest priority)
  let token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_VIP_CHAT_ID;

  // Layer 2: client-provided credentials from request body
  try {
    const body = (await req.json()) as { botToken?: string; chatId?: string };
    if (!token && body.botToken) token = body.botToken;
    if (!chatId && body.chatId) chatId = body.chatId;
  } catch {
    // Body may be absent or empty — ignore
  }

  if (!token || !chatId) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "✅ Quantix test mesajı." }),
    },
  );

  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    return NextResponse.json(
      { ok: false, error: data.description ?? "Telegram API error" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
