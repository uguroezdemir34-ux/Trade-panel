import { NextRequest, NextResponse } from "next/server";
import { formatNotifyMessage } from "@/lib/notify/telegram/formatter";
import { sendTelegramPhoto } from "@/lib/notify/telegram/client";
import type { NotifyMessage } from "@/lib/notify/types";
import { exportShareCardPngServer } from "@/lib/share/exportShareCardServer";
import type { ShareCardData } from "@/lib/share/renderShareCard";
import { buildShareText } from "@/lib/share/shareCardText";
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
 * İKİ KANAL, İKİ FARKLI KİTLE, TEK KART (kullanıcı kararı — hukuki bir
 * ayrım, kozmetik değil): skor ve kategori kırılımı bir ANALİZ ÇIKTISI,
 * TP/SL/giriş/R:R ise bir İŞLEM TALİMATI.
 *   - VIP (TELEGRAM_VIP_CHAT_ID): kart + TAM sinyal metni (TP/SL dahil)
 *     caption olarak. Caption 1024 karakteri aşarsa (Telegram sendPhoto
 *     limiti, sendMessage'ın 4096'sından farklı) veya kart hiç üretilemezse
 *     mevcut metin-only sendMessage'a düşülür — kritik sinyal metni bir
 *     görsel yüzünden kaybolmaz.
 *   - Halka açık (TELEGRAM_PUBLIC_CHAT_ID, opsiyonel — tanımsızsa sessizce
 *     atlanır): AYNI kart + buildShareText() çıktısı (parite/verdict/skor/
 *     yön eğilimi/fiyat/ibare/site) — TP/SL/giriş/R:R hiç geçmez. Kart
 *     üretilemediyse metne düşme YOK, bu kanal atlanır (tek içeriği kart).
 *
 * Kart BİR KEZ üretilir (exportShareCardPngServer tek çağrı), iki
 * gönderimde de aynı PNG buffer kullanılır. VIP ÖNCE gider; halka açık
 * gönderim best-effort ve bağımsız — VIP'in sonucunu asla etkilemez.
 */

function buildEnglishShareLabels() {
  // lib/i18n/en.ts'teki share/verdict/direction/score.categories
  // anahtarlarıyla BİREBİR aynı — yeni string icat edilmedi.
  return {
    verdict: { go: "GO", wait: "WAIT", no: "NO" } as Record<"go" | "wait" | "no", string>,
    direction: { LONG: "LONG", SHORT: "SHORT", NEUTRAL: "NEUTRAL" } as Record<
      "LONG" | "SHORT" | "NEUTRAL",
      string
    >,
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
    signalLabel: "Signal",
    scoreLabel: "Score",
    directionLeaningLabel: "Bias",
    priceOnlyLabel: "Price",
  };
}

/** trade_opened + sub varsa (useSignalFirehose'un 5dk teyit sonrası GO
 *  sinyali) kart için gereken veriyi kurar. confirmStatus her zaman
 *  "confirmed" — bu route sadece teyit tamamlandıktan SONRA tetiklenen
 *  mesajlar için çağrılıyor. */
function buildCardData(
  msg: NotifyMessage,
  labels: ReturnType<typeof buildEnglishShareLabels>,
): ShareCardData | null {
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
    labels,
  };
}

const PUBLIC_SITE_URL = "quantixos.com";

/**
 * Halka açık kanala AYNI kart PNG'sini + kısa başlığı gönderir —
 * best-effort, ÇAĞIRANIN VIP sonucunu ASLA etkilemez (bu fonksiyon hiçbir
 * hatayı fırlatmaz, içeride yutar + loglar). TELEGRAM_PUBLIC_CHAT_ID yoksa
 * sessizce hiçbir şey yapmadan döner — bu bir hata durumu değil.
 */
async function sendToPublicChannel(
  cardData: ShareCardData,
  labels: ReturnType<typeof buildEnglishShareLabels>,
  png: Buffer,
  botToken: string,
): Promise<void> {
  const publicChatId = process.env.TELEGRAM_PUBLIC_CHAT_ID;
  if (!publicChatId) return;

  // buildShareText — kartla AYNI kaynak fonksiyon (ShareButton.tsx da
  // bunu kullanıyor), format iki yerde ayrı ayrı yazılıp zamanla
  // ayrışmasın diye. TP/SL/giriş/R:R burada YOK — buildShareText'in
  // ürettiği alanlar sadece parite/verdict/skor/yön eğilimi/fiyat/ibare/site.
  const caption = buildShareText({
    pair: cardData.pair,
    direction: cardData.direction,
    verdict: cardData.verdict,
    confirmStatus: cardData.confirmStatus,
    score: cardData.score,
    priceLabel: cardData.priceLabel,
    labels,
    siteUrl: PUBLIC_SITE_URL,
  });

  const photoRes = await sendTelegramPhoto(
    { botToken, chatId: publicChatId },
    { photo: png, caption },
  );
  if (!photoRes.ok) {
    console.warn("[telegram/signal] Halka açık gönderim başarısız:", photoRes.errorMessage);
  }
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

  // Kart — BİR KEZ üretilir, VIP + halka açık ikisinde de aynı PNG
  // kullanılır (bkz. dosya başı yorumu). Üretim başarısız olursa VIP
  // metin-only'ye düşer, halka açık kanal tamamen atlanır.
  let cardPng: Buffer | null = null;
  let cardData: ShareCardData | null = null;
  const labels = buildEnglishShareLabels();
  if (body.msg.kind === "trade_opened") {
    cardData = buildCardData(body.msg, labels);
    if (cardData) {
      try {
        cardPng = await exportShareCardPngServer(cardData);
      } catch (err) {
        console.warn(
          "[telegram/signal] Kart üretimi başarısız, VIP metne düşülüyor:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  // VIP — kart varsa foto+tam metin caption dener (MarkdownV2, text zaten
  // escape edilmiş — formatNotifyMessage çıktısı). Caption 1024'ü aşarsa
  // Telegram 400 döner, photoRes.ok=false olur, aşağıdaki metin-only yola
  // düşülür — ayrı bir karakter sayma mantığı YOK, hata yanıtı zaten bunu
  // yakalıyor.
  let vipOk = false;
  if (cardPng) {
    const photoRes = await sendTelegramPhoto(
      { botToken: token, chatId },
      { photo: cardPng, caption: text, markdownV2: true },
    );
    if (photoRes.ok) {
      vipOk = true;
    } else {
      console.warn("[telegram/signal] VIP kart gönderimi başarısız, metne düşülüyor:", photoRes.errorMessage);
    }
  }

  if (!vipOk) {
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
  }

  // Halka açık kanal — VIP'ten SONRA, bağımsız, best-effort. Kart yoksa
  // (üretim başarısız oldu) bu kanal tamamen atlanır — metin-only yedeği
  // YOK, tek içeriği kart.
  if (cardPng && cardData) {
    await sendToPublicChannel(cardData, labels, cardPng, token);
  }

  return NextResponse.json({ ok: true });
}
