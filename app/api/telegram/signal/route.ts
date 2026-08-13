import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { formatNotifyMessage, formatGoSignalPublic, formatHumanCheckNumbers } from "@/lib/notify/telegram/formatter";
import { sendTelegramMessage, sendTelegramPhoto } from "@/lib/notify/telegram/client";
import { resolveTelegramConfig, resolvePublicChatId } from "@/lib/notify/telegram/config";
import { escapeMarkdownV2 } from "@/lib/notify/telegram/escape";
import { narrateHumanTraderCheck } from "@/lib/ai/narrateHumanTraderCheck";
import type { HumanTraderCheckResult } from "@/lib/signal/humanTraderCheck";
import type { NotifyMessage } from "@/lib/notify/types";
import { exportShareCardPngServer } from "@/lib/share/exportShareCardServer";
import type { ShareCardData } from "@/lib/share/renderShareCard";
import { buildShareText } from "@/lib/share/shareCardText";
import { formatTickPrice } from "@/lib/i18n/format";
import { exportSignalChartPngServer } from "@/lib/share/exportSignalChartServer";
import { fetchSignalChartData } from "@/lib/share/signalChartData";

// @napi-rs/canvas native binary — Edge runtime'da çalışmaz (bkz.
// lib/share/exportShareCardServer.ts).
export const runtime = "nodejs";

interface SignalBody {
  msg: NotifyMessage;
  /** Layer 2: browser-stored credentials (fallback when DB + env absent) */
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
 *
 * go_signal (useGoAlerts.ts, GO geçişinde ANINDA — trade_opened'ın 5dk
 * teyit gecikmesinden ÖNCE gelen, tek kategori-kırılımı/TP/SL İÇERMEYEN
 * kind) yukarıdaki kart mantığına HİÇ girmez (kind==="trade_opened" şartı
 * sağlanmaz, buildCardData zaten sub zorunlu tutuyor) — bu yüzden VIP her
 * zaman metin-only sendMessage'a düşer. Dosya sonundaki ayrı "go_signal"
 * bloğu public'e de gönderir — best-effort, VIP sonucunu etkilemez. Diğer
 * NotifyKind'lar (price_alarm/sl_proximity/consecutive_loss/
 * position_risk_violation vb., hesap-bazlı/kişisel uyarılar) kasıtlı
 * olarak public'e hiç gitmiyor — kapsam dışı.
 *
 * İNSAN TRADER KONTROLÜ + ANLATIM (takip turu, 1. turdaki
 * lib/signal/humanTraderCheck.ts'in devamı) — body.msg.humanCheck varsa
 * (trade_opened/go_signal, ikisi de bu noktaya SADECE onaylanmış "go"
 * sinyaller için ulaşır) narrateHumanTraderCheck() TEK SEFERDE çağrılır,
 * hem VIP hem public'e (escape farkıyla) eklenir. Anlatım prompt'u
 * BİLEREK Stop/TP FİYAT DEĞERİ görmüyor (narrateHumanTraderCheck.ts dosya
 * başı yorumu) — tek çağrı iki kanala da güvenle gidebiliyor. Stop/TP
 * fiyat DEĞERLERİ (deterministik, AI'sız) SADECE VIP metnine
 * formatHumanCheckNumbers(check, true) ile ekleniyor; public her zaman
 * includeTradeLevels=false alıyor (S/R + hacim + R:R ORANI, fiyat yok) —
 * "TP/SL/giriş/R:R = İŞLEM TALİMATI, public'e hiç gitmez" kuralı korunuyor.
 * narrateHumanTraderCheck() null dönerse (best-effort başarısız/
 * yapılandırılmamış) mesaj hiçbir zaman boş/eksik gitmez — text zaten
 * formatNotifyMessage()'ın ürettiği tam (artık sayısal detaylı) metin,
 * narration sadece bir ÖN EK.
 *
 * GÖRSEL — SİNYAL GRAFİĞİ (3. tur, lib/share/renderSignalChart.ts — YENİ,
 * renderShareCard.ts'in İSTATİSTİK kartından TAMAMEN AYRI, o dosyaya HİÇ
 * dokunulmadı). humanCheck varsa fetchSignalChartData() ile TAZE 4H mum +
 * S/R + trend çizgisi çekilir (lib/analysis/ai-scenario.ts'teki
 * fetchScenarioData()'nın DOĞRUDAN tekrar kullanımı — üçüncü bir OKX-fetch
 * kopyası yazılmadı), iki AYRI PNG render edilir: VIP (Entry/Stop/TP1/TP2
 * dahil) + public (dahil değil — aynı includeTradeLevels kuralı görsele de
 * uygulandı). Bu yeni grafik VIP'te cardPng'e (eski istatistik kartı),
 * public'te de aynı şekilde eski kart PNG'sine TERCİH EDİLİR
 * (`signalChartPng ?? cardPng`) — render/fetch başarısız olursa (best-effort,
 * try/catch içinde) null kalır, mevcut akışlar (eski kart → metin-only)
 * HİÇ DEĞİŞMEDEN, aynen önceki turdaki gibi çalışmaya devam eder.
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
 * hatayı fırlatmaz, içeride yutar + loglar). resolvePublicChatId() önce
 * Supabase'deki notification_config satırını dener, yoksa
 * TELEGRAM_PUBLIC_CHAT_ID env'e düşer (bkz. lib/notify/telegram/config.ts,
 * app/api/cron/signal-check ile AYNI desen) — ikisi de yoksa sessizce
 * hiçbir şey yapmadan döner, bu bir hata durumu değil.
 */
async function sendToPublicChannel(
  cardData: ShareCardData,
  labels: ReturnType<typeof buildEnglishShareLabels>,
  cardPng: Buffer | null,
  botToken: string,
  humanCheck: HumanTraderCheckResult | undefined,
  narrative: string | null,
  signalChartPng: Buffer | null,
): Promise<void> {
  // Yeni sinyal grafiği (varsa) eski istatistik kartına TERCİH EDİLİR —
  // bkz. dosya başı yorumu (VIP'teki AYNI `signalChartPng ?? cardPng`
  // deseni). İkisi de yoksa (ikisi de başarısız/üretilemedi) gönderilecek
  // görsel yok, bu kanal atlanır.
  const photoToSend = signalChartPng ?? cardPng;
  if (!photoToSend) return;

  const publicChatId = await resolvePublicChatId();
  if (!publicChatId) return;

  // buildShareText — kartla AYNI kaynak fonksiyon (ShareButton.tsx da
  // bunu kullanıyor), format iki yerde ayrı ayrı yazılıp zamanla
  // ayrışmasın diye. TP/SL/giriş/R:R burada YOK — buildShareText'in
  // ürettiği alanlar sadece parite/verdict/skor/yön eğilimi/fiyat/ibare/site.
  let caption = buildShareText({
    pair: cardData.pair,
    direction: cardData.direction,
    verdict: cardData.verdict,
    confirmStatus: cardData.confirmStatus,
    score: cardData.score,
    priceLabel: cardData.priceLabel,
    labels,
    siteUrl: PUBLIC_SITE_URL,
  });

  // İnsan trader kontrolü — narration + S/R/hacim/R:R ORANI. Stop/TP1/TP2
  // fiyat DEĞERİ YOK (includeTradeLevels=false — bkz. dosya başı yorumu).
  // caption PLAIN metin (aşağıdaki sendTelegramPhoto markdownV2 GEÇMİYOR,
  // varsayılan false) — narration/sayılar da düz metin, escape YOK.
  if (humanCheck) {
    const checkLines = formatHumanCheckNumbers(humanCheck, false);
    const extra = [...(narrative ? [narrative, ""] : []), ...checkLines];
    if (extra.length > 0) {
      caption = `${caption}\n\n${extra.join("\n")}`;
    }
  }

  const photoRes = await sendTelegramPhoto(
    { botToken, chatId: publicChatId },
    { photo: photoToSend, caption },
  );
  if (!photoRes.ok) {
    // Bu satıra gelindiğinde publicChatId zaten mevcuttu (yukarıdaki
    // "if (!publicChatId) return;" atlanmadı) — yapılandırma eksikliği
    // değil, her zaman gerçek bir gönderim hatası.
    console.warn("[telegram/signal] Halka açık gönderim başarısız:", photoRes.errorMessage);
    Sentry.captureMessage("Telegram public kanal gönderimi başarısız", {
      level: "warning",
      extra: { errorMessage: photoRes.errorMessage },
    });
  }
}

export async function POST(req: NextRequest) {
  // resolveTelegramConfig() önce Supabase'deki notification_config
  // satırını dener, yoksa process.env'e (TELEGRAM_BOT_TOKEN/
  // TELEGRAM_VIP_CHAT_ID) düşer — bkz. lib/notify/telegram/config.ts,
  // app/api/cron/signal-check ve app/api/telegram/test ile AYNI
  // çözümleme deseni (DB → env → client-provided).
  const resolved = await resolveTelegramConfig();
  let token = resolved?.botToken;
  let chatId = resolved?.chatId;

  let body: SignalBody;
  try {
    body = (await req.json()) as SignalBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // Layer 2 (geriye dönük uyumluluk) — DB + env'in ikisi de boşsa,
  // request body'sinden gelen client-provided credential'lara düşülür.
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

  // Anlatım — humanCheck varsa TEK SEFERDE üretilir (bkz. dosya başı
  // yorumu), hem VIP hem public'e aynı narration eklenir. Best-effort:
  // null dönerse (yapılandırılmamış/başarısız) text yukarıda ZATEN
  // tam/sayısal — hiçbir zaman boş/eksik mesaj gitmez.
  let narrative: string | null = null;
  if (body.msg.humanCheck) {
    narrative = await narrateHumanTraderCheck(
      {
        pair: body.msg.pair ?? "—",
        direction: body.msg.direction === "SHORT" ? "SHORT" : "LONG",
        score: body.msg.score ?? 0,
        price: body.msg.entry ?? 0,
      },
      body.msg.humanCheck,
    );
  }
  if (narrative) {
    // VIP metni MarkdownV2 (formatNotifyMessage çıktısı) — narration ham
    // AI metni, escape edilmeden eklenirse Telegram 400 döner (bkz.
    // escape.ts'in 18 özel karakteri, narration'da neredeyse kesin "." içerir).
    text = `${escapeMarkdownV2(narrative)}\n\n${text}`;
  }

  // Sinyal grafiği — humanCheck varsa (onaylanan GO sinyali) TAZE veriyle
  // İKİ AYRI PNG render edilir (VIP: trade seviyeli, public: değil — bkz.
  // dosya başı yorumu). Tamamen best-effort: try/catch içinde, herhangi
  // bir adım (fetch/render) başarısız olursa ikisi de null kalır — aşağıdaki
  // kart/metin akışları hiç etkilenmez.
  let signalChartPng: Buffer | null = null;
  let signalChartPublicPng: Buffer | null = null;
  if (body.msg.humanCheck && body.msg.pair && body.msg.direction) {
    try {
      const chartData = await fetchSignalChartData(body.msg.pair, body.msg.direction);
      if (chartData) {
        const tradeLevels = {
          entry: body.msg.entry ?? chartData.currentPrice,
          stopPrice: body.msg.humanCheck.rrCheck.stopPrice,
          tp1Price: body.msg.humanCheck.rrCheck.tp1Price,
          tp2Price: body.msg.humanCheck.rrCheck.tp2Price,
        };
        const baseChartData = {
          pair: body.msg.pair,
          direction: body.msg.direction,
          candles: chartData.candles,
          currentPrice: chartData.currentPrice,
          srLevels: chartData.srLevels,
          trendLine: chartData.trendLine,
          score: body.msg.score ?? 0,
        };
        signalChartPng = await exportSignalChartPngServer({ ...baseChartData, tradeLevels });
        // Public — tradeLevels YOK (undefined), formatHumanCheckNumbers()'ın
        // includeTradeLevels=false'uyla AYNI kural görsele de uygulanıyor.
        signalChartPublicPng = await exportSignalChartPngServer(baseChartData);
      }
    } catch (err) {
      console.warn(
        "[telegram/signal] Sinyal grafiği üretimi başarısız, mevcut kart/metin akışına düşülüyor:",
        err instanceof Error ? err.message : String(err),
      );
    }
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

  // VIP — foto+tam metin caption dener (MarkdownV2, text zaten escape
  // edilmiş — formatNotifyMessage çıktısı). Yeni sinyal grafiği (varsa)
  // eski istatistik kartına TERCİH EDİLİR — bkz. dosya başı yorumu. Caption
  // 1024'ü aşarsa Telegram 400 döner, photoRes.ok=false olur, aşağıdaki
  // metin-only yola düşülür — ayrı bir karakter sayma mantığı YOK, hata
  // yanıtı zaten bunu yakalıyor.
  const vipPhoto = signalChartPng ?? cardPng;
  let vipOk = false;
  if (vipPhoto) {
    const photoRes = await sendTelegramPhoto(
      { botToken: token, chatId },
      { photo: vipPhoto, caption: text, markdownV2: true },
    );
    if (photoRes.ok) {
      vipOk = true;
    } else {
      // Bu satıra gelindiğinde token/chatId zaten doğrulanmıştı (route
      // başında "if (!token || !chatId) return 400" atlanmadı) —
      // yapılandırma eksikliği değil, her zaman gerçek bir gönderim hatası.
      console.warn("[telegram/signal] VIP kart gönderimi başarısız, metne düşülüyor:", photoRes.errorMessage);
      Sentry.captureMessage("Telegram VIP kart gönderimi başarısız", {
        level: "warning",
        extra: { errorMessage: photoRes.errorMessage },
      });
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

  // Halka açık kanal — VIP'ten SONRA, bağımsız, best-effort. sendToPublicChannel()
  // kendi içinde ne eski kart ne yeni sinyal grafiği üretilebildiyse
  // (ikisi de null) atlıyor — metin-only yedeği YOK, tek içeriği görsel.
  if (cardData) {
    await sendToPublicChannel(cardData, labels, cardPng, token, body.msg.humanCheck, narrative, signalChartPublicPng);
  }

  // Halka açık kanal — go_signal (useGoAlerts.ts, GO geçişinde ANINDA, hiç
  // kart üretilmeyen tek NotifyKind) için gönderir — app/api/cron/signal-check/route.ts'teki
  // sendToVipAndPublic() ile AYNI genel desen (best-effort, VIP sonucunu
  // etkilemez), ama ARTIK VIP'in `text`'ini PAYLAŞMIYOR: formatGoSignalPublic()
  // Stop/TP1/TP2 fiyat DEĞERİ içermeyen AYRI bir metin üretiyor (humanCheck
  // eklendikten sonra VIP'in text'i işlem talimatı taşıyabiliyor — bkz.
  // formatGoSignalPublic() ve dosya başı yorumu). SADECE go_signal.
  if (body.msg.kind === "go_signal") {
    const publicChatId = await resolvePublicChatId();
    if (publicChatId) {
      let publicText = formatGoSignalPublic(body.msg);
      if (narrative) {
        publicText = `${escapeMarkdownV2(narrative)}\n\n${publicText}`;
      }

      // Yeni sinyal grafiği varsa foto+caption dener (aynı MarkdownV2 metin,
      // caption'da) — go_signal'ın önceden hiç görseli yoktu (bkz. dosya
      // başı yorumu). Caption 1024'ü aşarsa (VIP'teki AYNI overflow
      // deseni) sendTelegramPhoto 400 döner, aşağıdaki sendTelegramMessage
      // yedeğine düşülür — text'in kendisi (4096 limit) HİÇ değişmiyor.
      let publicSent = false;
      if (signalChartPublicPng) {
        const photoRes = await sendTelegramPhoto(
          { botToken: token, chatId: publicChatId },
          { photo: signalChartPublicPng, caption: publicText, markdownV2: true },
        );
        if (photoRes.ok) {
          publicSent = true;
        } else {
          console.warn(
            "[telegram/signal] GO sinyali (public) grafik gönderimi başarısız, metne düşülüyor:",
            photoRes.errorMessage,
          );
        }
      }

      if (!publicSent) {
        const publicResult = await sendTelegramMessage(
          { botToken: token, chatId: publicChatId },
          { text: publicText },
        );
        if (!publicResult.ok) {
          // publicChatId burada zaten mevcuttu — yapılandırma eksikliği
          // değil, her zaman gerçek bir gönderim hatası.
          console.warn("[telegram/signal] GO sinyali (public) gönderimi başarısız:", publicResult.errorMessage);
          Sentry.captureMessage("Telegram GO sinyali (public) gönderimi başarısız", {
            level: "warning",
            extra: { errorMessage: publicResult.errorMessage },
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
