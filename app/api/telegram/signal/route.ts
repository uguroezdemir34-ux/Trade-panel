import { NextRequest, NextResponse } from "next/server";
import { formatNotifyMessage } from "@/lib/notify/telegram/formatter";
import { sendTelegramPhoto } from "@/lib/notify/telegram/client";
import type { NotifyMessage } from "@/lib/notify/types";
import { exportShareCardPngServer } from "@/lib/share/exportShareCardServer";
import type { ShareCardData } from "@/lib/share/renderShareCard";
import { formatTickPrice } from "@/lib/i18n/format";

// @napi-rs/canvas native binary — Edge runtime'da çalışmaz (bkz.
// lib/share/exportShareCardServer.ts).
export const runtime = "nodejs";

interface SignalBody {
  msg: NotifyMessage;
  /** Layer 2: browser-stored credentials (fallback when env vars absent) */
  botToken?: string;
  chatId?: string;
}

/**
 * trade_opened + sub varsa (useSignalFirehose'un 5dk teyit sonrası GO
 * sinyali — bkz. o dosyanın fireSignal() yorumu) sabit İngilizce etiketli
 * bir ShareCardData üretir. confirmStatus her zaman "confirmed" — bu route
 * sadece teyit tamamlandıktan SONRA tetiklenen mesajlar için çağrılıyor,
 * pending/unknown durumu bu yoldan hiç geçmiyor. Dil kullanıcı kararıyla
 * İngilizce sabitlendi (VIP kanal tek bir dilde, kullanıcının tarayıcı
 * dilini sunucu bilemiyor) — metinler lib/i18n/en.ts'teki share, verdict,
 * direction, score.categories anahtarlarıyla BİREBİR aynı (yeni string
 * icat edilmedi, ShareButton'ın ürettiği kartla tutarlı).
 */
function buildEnglishShareCardData(msg: NotifyMessage): ShareCardData | null {
  if (!msg.pair || !msg.direction || !msg.sub || msg.score === undefined) return null;
  return {
    pair: msg.pair,
    direction: msg.direction,
    verdict: "go",
    confirmStatus: "confirmed",
    score: msg.score,
    sub: msg.sub,
    priceLabel: msg.entry != null && msg.entry > 0 ? formatTickPrice(msg.entry, "en") : "—",
    ts: msg.timestamp ?? Date.now(),
    locale: "en",
    labels: {
      verdict: { go: "GO", wait: "WAIT", no: "NO" },
      direction: { LONG: "LONG", SHORT: "SHORT", NEUTRAL: "NEUTRAL" },
      confirmPending: "confirmation pending",
      confirmUnknown: "confirmation status unknown",
      disclaimer: "Not investment advice",
      scoreWeightedNote: "regime-weighted",
      categoriesRawLabel: "raw category scores",
      categories: {
        trend: "Trend",
        adx: "ADX",
        rsi: "RSI",
        vol: "Volume",
        bb: "BB",
        vwap: "VWAP",
        funding: "Funding",
        macro: "Macro",
      },
    },
  };
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

  // Kart eki — başarısız olursa AŞAĞIDAKİ mevcut metin-only yola düşülür
  // (sessizce yutulmaz, console.warn ile loglanır). Bu bilinçli bir tercih:
  // dekoratif bir görsel üretimi başarısız oldu diye kritik sinyal metni
  // hiç gitmesin istemiyoruz.
  if (body.msg.kind === "trade_opened") {
    const cardData = buildEnglishShareCardData(body.msg);
    if (cardData) {
      try {
        const png = await exportShareCardPngServer(cardData);
        const photoRes = await sendTelegramPhoto(
          { botToken: token, chatId },
          { photo: png, caption: text },
        );
        if (photoRes.ok) {
          return NextResponse.json({ ok: true, withCard: true });
        }
        console.warn("[telegram/signal] Kart gönderimi başarısız, metne düşülüyor:", photoRes.errorMessage);
      } catch (err) {
        console.warn(
          "[telegram/signal] Kart üretimi başarısız, metne düşülüyor:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
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
