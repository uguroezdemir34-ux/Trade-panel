/**
 * CRON: AI SENARYO GRAFİĞİ — /api/cron/ai-scenario
 *
 * 3 sabit sembol (BTC/ETH/SOL — 9 paritenin tamamı değil, ilk aşama,
 * genişletme ayrı karar) için: fetchScenarioData → calculateAIScore →
 * formatAIScenarioCaption → exportScenarioChartPngServer → sendTelegramPhoto,
 * sırayla (paralel değil), sembol başına try/catch ile izole.
 *
 * SADECE PUBLIC KANAL — VIP'e hiç gönderilmiyor, kasıtlı: AI Senaryo
 * caption'ı (lib/analysis/telegram-format.ts) TP/SL/giriş/R:R İÇERMİYOR,
 * sadece skor+S/R analizi — app/api/telegram/signal/route.ts'teki
 * "public=analiz çıktısı, VIP=işlem talimatı" hukuki ayrımına göre bu
 * içerik public kanalın kapsamına giriyor. Bu yüzden resolveTelegramConfig()
 * (VIP config) SADECE botToken için çağrılıyor — dönen chatId (VIP kanal
 * ID'si) KASITLI OLARAK yok sayılıyor, gönderim hedefi her zaman
 * resolvePublicChatId()'in döndürdüğü public chat ID. resolvePublicChatId()
 * kendi başına botToken döndürmüyor (sadece chat ID string'i) — ayrı bir
 * "public config" fonksiyonu da yok (lib/notify/telegram/config.ts'te
 * doğrulandı), bu yüzden botToken için VIP config'e başvurmak mevcut API
 * yüzeyinde tek yol.
 *
 * X (Twitter) gönderimi bu route'ta YOK — kapsam dışı (ayrı, ücretli API
 * kararı gerektiriyor, henüz alınmadı).
 *
 * Config eksikse (botToken veya public chat ID yoksa) ayrı bir hata şekli
 * DÖNDÜRÜLMÜYOR — signal-check'in "her zaman ok:true + özet" desenine
 * uyuyoruz: her sembol "skipped" olarak işaretlenip normal results
 * dizisiyle dönülüyor.
 */

import { NextResponse } from "next/server";
// app/api/cron/signal-check/route.ts, app/api/telegram/signal/route.ts,
// app/api/csp-report/route.ts ve app/api/stripe/webhook/route.ts'in HEPSİ
// bu namespace import'u kullanıyor (4/4 karşılaştırılabilir route.ts
// dosyası) — lib/hooks/*'teki NAMED `captureMessage` import'u (bkz.
// useSignalFirehose.ts) İSTEMCİ TARAFI bundle boyutu içindi, bu dosya
// sunucu-only bir route (asla tarayıcı bundle'ına girmiyor), o tree-shake
// endişesi burada hiç geçerli değil — bu yüzden bu dosyanın KENDİ
// kategorisindeki (route.ts) yerleşik desen izlendi, client-hook deseni
// değil.
import * as Sentry from "@sentry/nextjs";
import { fetchScenarioData } from "@/lib/analysis/ai-scenario";
import { calculateAIScore } from "@/lib/analysis/score";
import { formatAIScenarioCaption } from "@/lib/analysis/telegram-format";
import { exportScenarioChartPngServer } from "@/lib/share/exportScenarioChartServer";
import { sendTelegramPhoto } from "@/lib/notify/telegram/client";
import { resolveTelegramConfig, resolvePublicChatId } from "@/lib/notify/telegram/config";
import { uploadPublicImage } from "@/lib/db/storage";
import {
  insertAiScenario,
  getScenariosPendingOutcome,
  writeScenarioOutcome,
  type ScenarioOutcomeField,
  type PendingOutcomeScenario,
} from "@/lib/db/aiScenarios";
import { fetch24hTickers } from "@/lib/server/signalEngine";
import { ADVERSE_THRESHOLD_PCT } from "@/lib/signals/outcomeTracking";
import type { Pair } from "@/lib/constants/pairs";

export const runtime = "nodejs";
export const maxDuration = 60;

// signal-check/route.ts + daily-summary/route.ts'teki AYNI 4 satır — yerel
// kopya, BİLEREK: repodaki gerçek emsal 2/2 (her cron route kendi kopyasını
// tutuyor, paylaşılan bir import/lib/cron/auth.ts'e hiç çıkarılmamış).
function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const SCENARIO_SYMBOLS: Pair[] = ["BTC", "ETH", "SOL"];

interface ScenarioResult {
  symbol: Pair;
  status: "sent" | "skipped" | "error";
  reason?: string;
  dbWritten?: boolean;
}

// Outcome pencereleri — signal-check/route.ts'teki OUTCOME_15M_*/OUTCOME_1H_*
// ile AYNI mantık: cron periyoduyla eşleşen tolerans payı. Bu cron 8 saatte
// bir çalışıyor (vercel.json: "5 5,13,21 * * *") — 4H penceresi 4-12sa
// (8sa'lık tolerans), 24H penceresi 24-32sa (aynı 8sa'lık tolerans).
const OUTCOME_4H_MIN_MS = 4 * 60 * 60_000;
const OUTCOME_4H_MAX_MS = 12 * 60 * 60_000;
const OUTCOME_24H_MIN_MS = 24 * 60 * 60_000;
const OUTCOME_24H_MAX_MS = 32 * 60 * 60_000;

type ScoreDirection = "bull" | "bear" | "neutral";

// lib/analysis/telegram-format.ts'teki directionLabel ile AYNI eşik
// (>=60/<=40) — üçüncü bilinçli kopya (ilki components/grafik/
// AiScenarioTab.tsx'te). Burada görüntü metni değil, makine-okunur bir
// yön kategorisi lazım, bu yüzden directionLabel'ın kendisi değil sadece
// eşiği kopyalandı.
function scoreDirection(score: number): ScoreDirection {
  if (score >= 60) return "bull";
  if (score <= 40) return "bear";
  return "neutral";
}

// Kullanıcı tarafından spesifiye edildi ve onaylandı. Migration 025'in
// yorumundaki tek cümlelik tanımdan ("skorun yönü ile gerçek hareketin
// ±0.5% eşiğiyle uyuşup uyuşmadığı") türetilen üç kural:
//   bull    (score>=60):     movePct >= +ADVERSE_THRESHOLD_PCT ise doğru
//   bear    (score<=40):     movePct <= -ADVERSE_THRESHOLD_PCT ise doğru
//   neutral (40<score<60):   |movePct| < ADVERSE_THRESHOLD_PCT ise doğru
//     (fiyat belirgin hareket etmediyse "nötr" tahmini doğrulanmış sayılır)
function isScenarioOutcomeCorrect(score: number, movePct: number): boolean {
  const dir = scoreDirection(score);
  if (dir === "bull") return movePct >= ADVERSE_THRESHOLD_PCT;
  if (dir === "bear") return movePct <= -ADVERSE_THRESHOLD_PCT;
  return Math.abs(movePct) < ADVERSE_THRESHOLD_PCT;
}

/**
 * signal-check/route.ts'teki processOutcomeBatch ile AYNI iskelet —
 * BASİTLEŞTİRİLMİŞ: Telegram/X bildirimi YOK (spesifikasyonda istenmedi,
 * outcome sadece DB'ye yazılıyor). Ticker'da parite yoksa/currentPrice<=0
 * ise satır SESSİZCE atlanır — bir sonraki cron çalışmasında pencere
 * içindeyse tekrar denenir (go_signals ile aynı "veri kaybı yok, sadece
 * gecikme" garantisi).
 */
async function processScenarioOutcomeBatch(
  pending: PendingOutcomeScenario[],
  field: ScenarioOutcomeField,
  tickers: Map<Pair, { last: number; chg24hPct: number }>,
  nowMs: number,
): Promise<void> {
  for (const scenario of pending) {
    const currentPrice = tickers.get(scenario.symbol as Pair)?.last;
    if (!currentPrice || currentPrice <= 0 || scenario.triggerPrice <= 0) continue;
    try {
      const movePct = ((currentPrice - scenario.triggerPrice) / scenario.triggerPrice) * 100;
      const wasCorrect = isScenarioOutcomeCorrect(scenario.score.score, movePct);
      await writeScenarioOutcome(scenario.id, field, {
        movePct,
        price: currentPrice,
        wasCorrect,
        capturedAtMs: nowMs,
      });
    } catch (err) {
      console.error(`[ai-scenario] outcome${field} write failed for ${scenario.id}:`, err);
    }
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: ScenarioResult[] = [];

  const vipConfig = await resolveTelegramConfig();
  const publicChatId = await resolvePublicChatId();

  if (!vipConfig || !publicChatId) {
    for (const symbol of SCENARIO_SYMBOLS) {
      results.push({
        symbol,
        status: "skipped",
        reason: !vipConfig ? "telegram_bot_token_unavailable" : "public_chat_unavailable",
      });
    }
    return NextResponse.json({ ok: true, results });
  }

  // chatId BİLEREK vipConfig'ten DEĞİL, publicChatId'den — bkz. dosya başı yorumu.
  const config = { botToken: vipConfig.botToken, chatId: publicChatId };

  for (const symbol of SCENARIO_SYMBOLS) {
    // Sentry.captureException'ın extra bağlamı için — hangi adımda
    // patladığını görünür kılıyor (fetch/score/caption/render/send),
    // mevcut davranışı (akış/continue mantığı) HİÇ değiştirmiyor, sadece
    // izleniyor. "insert" adımı buraya girmiyor — DB yazımı kendi ayrı
    // try/catch'inde izole (satır ~206), oraya düşen bir hata zaten bu
    // dış catch'e hiç ulaşmıyor.
    let step: "fetch" | "score" | "caption" | "render" | "send" = "fetch";
    try {
      const marketData = await fetchScenarioData(symbol);
      if (!marketData) {
        results.push({ symbol, status: "skipped", reason: "market_data_unavailable" });
        continue;
      }
      const { srLevels, k1h, currentPrice } = marketData;

      step = "score";
      const scoreResult = calculateAIScore(k1h, srLevels, currentPrice);
      if (!scoreResult) {
        results.push({ symbol, status: "skipped", reason: "score_insufficient_data" });
        continue;
      }

      step = "caption";
      const caption = formatAIScenarioCaption(symbol, currentPrice, scoreResult, srLevels);

      step = "render";
      const png = await exportScenarioChartPngServer({
        symbol,
        candles: k1h,
        currentPrice,
        srLevels,
        score: scoreResult,
      });

      step = "send";
      const sendResult = await sendTelegramPhoto(config, { photo: png, caption, markdownV2: true });

      let dbWritten = false;
      try {
        const imageUrl = await uploadPublicImage(
          "ai-scenario-charts",
          `${symbol}-latest.png`,
          png,
          "image/png",
        );
        await insertAiScenario({
          symbol,
          timeframe: "4h",
          currentPrice,
          score: scoreResult,
          srLevels,
          chartImageUrl: imageUrl,
        });
        dbWritten = true;
      } catch (err) {
        console.error(`[ai-scenario] ${symbol} db write failed:`, err);
      }

      if (!sendResult.ok) {
        results.push({ symbol, status: "error", reason: sendResult.errorKind, dbWritten });
        console.error(`[ai-scenario] ${symbol} send failed:`, sendResult.errorMessage);
        continue;
      }

      results.push({ symbol, status: "sent", dbWritten });
    } catch (err) {
      results.push({
        symbol,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
      console.error(`[ai-scenario] ${symbol} unexpected error:`, err);
      // Mevcut davranış (console.error, non-fatal — döngü diğer sembollere
      // devam eder) DEĞİŞMEDİ, sadece Sentry'ye de düşüyor (symbol/step
      // extra'sıyla filtrelenebilir).
      Sentry.captureException(err, { extra: { symbol, step } });
    }
  }

  // ── Outcome check: fill in outcome_4h/outcome_24h for past scenarios ──
  // signal-check/route.ts'teki outcome bloğuyla AYNI "non-fatal" izolasyon
  // — bu blok yukarıdaki sembol döngüsünden BAĞIMSIZ kendi try/catch'i
  // içinde, bir Supabase/OKX hatası zaten tamamlanmış Telegram gönderimini
  // asla geçersiz kılmaz.
  try {
    const nowMs = Date.now();
    const [pending4h, pending24h] = await Promise.all([
      getScenariosPendingOutcome("4h", nowMs, OUTCOME_4H_MIN_MS, OUTCOME_4H_MAX_MS),
      getScenariosPendingOutcome("24h", nowMs, OUTCOME_24H_MIN_MS, OUTCOME_24H_MAX_MS),
    ]);

    if (pending4h.length > 0 || pending24h.length > 0) {
      const tickers = await fetch24hTickers(SCENARIO_SYMBOLS);
      await processScenarioOutcomeBatch(pending4h, "4h", tickers, nowMs);
      await processScenarioOutcomeBatch(pending24h, "24h", tickers, nowMs);
    }
  } catch (err) {
    console.error("[ai-scenario] outcome check failed:", err);
  }

  return NextResponse.json({ ok: true, results });
}
