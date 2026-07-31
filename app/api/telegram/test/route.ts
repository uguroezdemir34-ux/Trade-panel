import { NextRequest, NextResponse } from "next/server";
import { resolveTelegramConfig } from "@/lib/notify/telegram/config";

export async function POST(req: NextRequest) {
  // resolveTelegramConfig() önce Supabase'deki notification_config
  // satırını dener, yoksa process.env'e (TELEGRAM_BOT_TOKEN/
  // TELEGRAM_VIP_CHAT_ID) düşer — bkz. lib/notify/telegram/config.ts.
  // NotificationConfigCard'ın "Test Et" butonu bu route'u body GÖNDERMEDEN
  // çağırıyor, tamamen bu çözümlemeye güveniyor.
  const resolved = await resolveTelegramConfig();
  let token = resolved?.botToken;
  let chatId = resolved?.chatId;

  // Layer 2 (geriye dönük uyumluluk) — yukarıdakilerin ikisi de boşsa,
  // request body'sinden gelen client-provided credential'lara düşülür.
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
