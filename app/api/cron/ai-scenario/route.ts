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
import { fetchScenarioData } from "@/lib/analysis/ai-scenario";
import { calculateAIScore } from "@/lib/analysis/score";
import { formatAIScenarioCaption } from "@/lib/analysis/telegram-format";
import { exportScenarioChartPngServer } from "@/lib/share/exportScenarioChartServer";
import { sendTelegramPhoto } from "@/lib/notify/telegram/client";
import { resolveTelegramConfig, resolvePublicChatId } from "@/lib/notify/telegram/config";
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
    try {
      const marketData = await fetchScenarioData(symbol);
      if (!marketData) {
        results.push({ symbol, status: "skipped", reason: "market_data_unavailable" });
        continue;
      }
      const { srLevels, k1h, currentPrice } = marketData;

      const scoreResult = calculateAIScore(k1h, srLevels, currentPrice);
      if (!scoreResult) {
        results.push({ symbol, status: "skipped", reason: "score_insufficient_data" });
        continue;
      }

      const caption = formatAIScenarioCaption(symbol, currentPrice, scoreResult, srLevels);
      const png = await exportScenarioChartPngServer({
        symbol,
        candles: k1h,
        currentPrice,
        srLevels,
        score: scoreResult,
      });

      const sendResult = await sendTelegramPhoto(config, { photo: png, caption, markdownV2: true });
      if (!sendResult.ok) {
        results.push({ symbol, status: "error", reason: sendResult.errorKind });
        console.error(`[ai-scenario] ${symbol} send failed:`, sendResult.errorMessage);
        continue;
      }

      results.push({ symbol, status: "sent" });
    } catch (err) {
      results.push({
        symbol,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
      console.error(`[ai-scenario] ${symbol} unexpected error:`, err);
    }
  }

  return NextResponse.json({ ok: true, results });
}
