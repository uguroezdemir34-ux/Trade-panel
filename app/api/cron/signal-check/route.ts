/**
 * CRON: HOURLY SIGNAL CHECK — /api/cron/signal-check
 *
 * Schedule: every hour (vercel.json: "0 * * * *")
 * Auth: CRON_SECRET (set automatically by Vercel in env)
 *
 * Logic (stateless deduplication):
 *   For each of 15 pairs: compute score for last closed bar.
 *   Compare with second-to-last bar score.
 *   If current=GO and previous≠GO → new signal transition → send Telegram.
 *
 * This means: signal fires once per GO transition even when browser is closed.
 * If browser is also open and sends the signal, user gets a duplicate — the
 * server message is tagged [SERVER] so it's distinguishable.
 *
 * DUAL-CHANNEL — VIP (zorunlu) + public (opsiyonel, tanımsızsa sessizce
 * atlanır). Config artık DB-öncelikli: resolveTelegramConfig()/
 * resolvePublicChatId() (lib/notify/telegram/config.ts) önce Supabase'deki
 * notification_config satırını dener, yoksa process.env'e (TELEGRAM_
 * BOT_TOKEN/TELEGRAM_VIP_CHAT_ID/TELEGRAM_PUBLIC_CHAT_ID) düşer. GO sinyal
 * ve sonuç-takip mesajları AYNI metinle iki kanala da gönderilir —
 * app/api/telegram/signal/route.ts'in aksine ayrı bir sadeleştirme yok,
 * çünkü buradaki mesajlar zaten TP/SL/giriş/R:R içermiyor (bkz.
 * sendToVipAndPublic() yorumu).
 *
 * Vercel plan requirement:
 *   Hobby:  2 crons/project, 10s max duration (30 pairs × ~200ms = ~6s → fits)
 *   Pro:    unlimited crons, 60s max duration
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { PAIRS } from "@/lib/constants/pairs";
import type { Pair } from "@/lib/constants/pairs";
import { computeAllSignals, fetch24hTickers } from "@/lib/server/signalEngine";
import { resolveTelegramConfig, resolvePublicChatId, type TelegramConfig } from "@/lib/notify/telegram/config";
import { sendTelegramMessage } from "@/lib/notify/telegram/client";
import { escapeMarkdownV2, bold } from "@/lib/notify/telegram/escape";
import {
  insertGoSignal,
  getSignalsPendingOutcome,
  writeSignalOutcome,
  type OutcomeField,
  type PendingOutcomeSignal,
} from "@/lib/db/goSignals";
import { insertScoreHistoryBatch, type ScoreHistoryInput } from "@/lib/db/scoreHistory";
import { directionalMovePct, isAdverseMove } from "@/lib/signals/outcomeTracking";

export const runtime = "nodejs";
export const maxDuration = 10;

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // allow in dev
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function formatPrice(n: number): string {
  if (n >= 10000) return `$${n.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`; // SHIB/FET gibi çok küçük fiyatlar için
}

// Sunucu tarafı outcome penceresi — client'taki dar pencereden (15-20dk,
// 60-65dk) KASITLI OLARAK daha geniş: bu cron saatte bir çalışıyor (2-cron
// Hobby plan limiti nedeniyle ayrı, sık çalışan bir cron eklenmedi —
// kullanıcı onayıyla). Bkz. lib/db/goSignals.ts + supabase/migrations/008.
const OUTCOME_15M_MIN_MS = 15 * 60_000;
const OUTCOME_15M_MAX_MS = 75 * 60_000;
const OUTCOME_1H_MIN_MS = 60 * 60_000;
const OUTCOME_1H_MAX_MS = 120 * 60_000;

/**
 * Sonuç takip mesajı — orijinal sinyal mesajından (buildSignalMessage)
 * BİLEREK farklı format/başlık: aynı formatta gönderilse iki mesaj görsel
 * olarak ayırt edilemez, kullanıcı hangisinin "yeni sinyal" hangisinin
 * "eski sinyalin sonucu" olduğunu karıştırabilir (ROADMAP ADIM 2 madde 2 —
 * kazanan VE kaybeden AYNI formatta, hiçbir filtreleme yok).
 */
function buildOutcomeMessage(
  pair: string,
  direction: string,
  field: OutcomeField,
  triggerPrice: number,
  currentPrice: number,
  movePct: number,
  isAdverse: boolean,
): string {
  const dirEmoji = direction === "LONG" ? "▲" : direction === "SHORT" ? "▼" : "◆";
  const resultEmoji = isAdverse ? "❌" : "✅";
  const windowLabel = field === "15m" ? "15 Dakika" : "1 Saat";
  const movePctSign = movePct >= 0 ? "+" : "";
  const movePctText = `${movePctSign}${movePct.toFixed(2)}%`;
  const lines: string[] = [
    `${resultEmoji} ${bold("SONUÇ TAKİBİ")} ${escapeMarkdownV2(`· ${windowLabel}`)}`,
    "",
    `${dirEmoji} ${bold(pair)} ${escapeMarkdownV2(direction)}`,
    escapeMarkdownV2(`Giriş: ${formatPrice(triggerPrice)}  →  Şimdi: ${formatPrice(currentPrice)}`),
    `${resultEmoji} ${bold(movePctText)} ${escapeMarkdownV2(isAdverse ? "(aleyhte)" : "(isabet)")}`,
    "",
    `\\#${escapeMarkdownV2(pair)} \\#${escapeMarkdownV2(direction)} \\#SONUÇ`,
  ];
  return lines.join("\n");
}

/**
 * PUBLIC KANAL — resolvePublicChatId() (lib/notify/telegram/config.ts)
 * önce Supabase'deki notification_config satırını dener, yoksa
 * TELEGRAM_PUBLIC_CHAT_ID env'e düşer — opsiyonel, ikisi de yoksa null
 * (app/api/telegram/signal/route.ts'teki TELEGRAM_PUBLIC_CHAT_ID ile AYNI
 * "tanımsızsa sessizce atla" felsefesi, artık DB-farkında).
 *
 * O route'taki sendToPublicChannel() BİLEREK burada tekrar kullanılmadı —
 * o fonksiyon karta (PNG buffer + kısaltılmış caption) bağlı, cron'un
 * ürettiği buildSignalMessage()/buildOutcomeMessage() çıktısı ise zaten düz
 * metin ve TP/SL/giriş/R:R HİÇ İÇERMİYOR (ikisi de kod okunarak doğrulandı:
 * sadece pair/direction/price/score veya pair/direction/giriş→şimdi/movePct)
 * — yani route'taki "analiz çıktısı vs işlem talimatı" ayrımı burada zaten
 * baştan sağlanmış durumda, ayrı bir sadeleştirme adımına gerek yok, AYNI
 * metin iki kanala da gönderiliyor.
 */

interface VipPublicSendResult {
  vipOk: boolean;
  vipErrorMessage?: string;
  /** publicChatId hiç tanımlı değilse false — bu durumda publicOk anlamsız. */
  publicAttempted: boolean;
  publicOk: boolean;
  publicErrorMessage?: string;
}

/**
 * VIP'e (zorunlu, her zaman denenir) + varsa public'e (opsiyonel,
 * best-effort) AYNI metni gönderir. sendTelegramMessage() kendi içinde
 * retry/timeout/hata durumlarını yakalayıp hep bir SendMessageResult
 * döndürür (throw etmez) — burada ayrıca try/catch'e gerek yok. Public
 * gönderimin başarısız olması VIP sonucunu hiç etkilemez, çağıran taraf
 * ikisini ayrı ayrı sayaçlayıp loglar.
 */
async function sendToVipAndPublic(
  config: TelegramConfig,
  publicChatId: string | null,
  text: string,
): Promise<VipPublicSendResult> {
  const vipResult = await sendTelegramMessage(config, { text });

  if (!publicChatId) {
    return {
      vipOk: vipResult.ok,
      vipErrorMessage: vipResult.errorMessage,
      publicAttempted: false,
      publicOk: false,
    };
  }

  const publicResult = await sendTelegramMessage(
    { botToken: config.botToken, chatId: publicChatId },
    { text },
  );
  return {
    vipOk: vipResult.ok,
    vipErrorMessage: vipResult.errorMessage,
    publicAttempted: true,
    publicOk: publicResult.ok,
    publicErrorMessage: publicResult.errorMessage,
  };
}

interface OutcomeBatchResult {
  written: number;
  notified: number;
  notifyFailed: number;
  notifiedPublic: number;
  notifyFailedPublic: number;
}

/**
 * Bekleyen sinyal listesini tickers Map'iyle işler.
 *
 * Bildirim, writeSignalOutcome() BAŞARILI olduktan HEMEN SONRA, aynı döngü
 * adımında gönderilir — ayrı bir "bildirildi mi" kolonu YOK ve gerekmiyor:
 * getSignalsPendingOutcome() zaten sadece outcome_{field}_captured_at IS
 * NULL olan satırları seçiyor, writeSignalOutcome bu alanı dolduran işlemin
 * kendisi — yani bir sonraki cron çalışmasında bu satır artık pending
 * listesine hiç girmeyecek (doğal, tek-seferlik garanti). Kaynak client mı
 * server mı ayrımı YAPILMIYOR — go_signals'taki her satır (client-side
 * useSignalFirehose.ts VEYA bu cron'un kendi GO sinyali fark etmeksizin)
 * aynı şekilde işlenir.
 *
 * Telegram gönderimi başarısız olursa retry YOK (DB satırı zaten
 * captured_at dolu, bir daha pending listesine girmeyecek) — mevcut GO
 * sinyali gönderim deseniyle aynı risk sınıfı, sessizce yutulmaz,
 * console.error ile loglanır.
 */
async function processOutcomeBatch(
  pending: PendingOutcomeSignal[],
  field: OutcomeField,
  tickers: Map<Pair, { last: number; chg24hPct: number }>,
  nowMs: number,
  telegramConfig: TelegramConfig | null,
  publicChatId: string | null,
): Promise<OutcomeBatchResult> {
  let written = 0;
  let notified = 0;
  let notifyFailed = 0;
  let notifiedPublic = 0;
  let notifyFailedPublic = 0;
  for (const sig of pending) {
    // sig.pair DB'den geliyor (string) ama go_signals'a sadece bu sistemin
    // kendisi PAIRS listesinden yazıyor — Pair union'ına daraltmak güvenli.
    const currentPrice = tickers.get(sig.pair as Pair)?.last;
    if (!currentPrice || currentPrice <= 0 || sig.triggerPrice <= 0) continue;
    try {
      const movePct = ((currentPrice - sig.triggerPrice) / sig.triggerPrice) * 100;
      const movePctDir = directionalMovePct(sig.triggerPrice, currentPrice, sig.direction);
      const isAdverse = isAdverseMove(movePctDir);
      await writeSignalOutcome(sig.id, field, {
        movePct,
        price: currentPrice,
        isAdverse,
        capturedAtMs: nowMs,
      });
      written++;

      if (telegramConfig) {
        const text = buildOutcomeMessage(
          sig.pair,
          sig.direction,
          field,
          sig.triggerPrice,
          currentPrice,
          movePct,
          isAdverse,
        );
        const result = await sendToVipAndPublic(telegramConfig, publicChatId, text);
        if (result.vipOk) {
          notified++;
        } else {
          notifyFailed++;
          // Bu bloğa "if (telegramConfig)" içinden girildi — yapılandırma
          // eksikliği değil, her zaman gerçek bir gönderim hatası.
          console.error(
            `[CRON signal-check] outcome${field} Telegram bildirimi başarısız (${sig.id}):`,
            result.vipErrorMessage,
          );
          Sentry.captureMessage("Telegram outcome bildirimi (VIP) başarısız", {
            level: "warning",
            extra: { field, signalId: sig.id, errorMessage: result.vipErrorMessage },
          });
        }
        if (result.publicAttempted) {
          if (result.publicOk) {
            notifiedPublic++;
          } else {
            notifyFailedPublic++;
            console.error(
              `[CRON signal-check] outcome${field} Public Telegram bildirimi başarısız (${sig.id}):`,
              result.publicErrorMessage,
            );
            Sentry.captureMessage("Telegram outcome bildirimi (public) başarısız", {
              level: "warning",
              extra: { field, signalId: sig.id, errorMessage: result.publicErrorMessage },
            });
          }
        }
      }
    } catch (err) {
      console.error(`[CRON signal-check] outcome${field} write failed for ${sig.id}:`, err);
    }
  }
  return { written, notified, notifyFailed, notifiedPublic, notifyFailedPublic };
}

function buildSignalMessage(
  pair: string,
  direction: string,
  score: number,
  price: number,
): string {
  const dirEmoji = direction === "LONG" ? "▲" : direction === "SHORT" ? "▼" : "◆";
  const lines: string[] = [
    `⚡ ${bold("QUANTIX SERVER SIGNAL")}`,
    "",
    `${dirEmoji} ${bold(pair)} ${escapeMarkdownV2(direction)} ${escapeMarkdownV2("@ " + formatPrice(price))}`,
    escapeMarkdownV2(`Score: ${score}/100`),
    "",
    escapeMarkdownV2("🤖 Sunucu tarafı sinyal — browser kapalıyken gönderildi"),
    `\\#${escapeMarkdownV2(pair)} \\#${escapeMarkdownV2(direction)} \\#SERVER`,
  ];
  return lines.join("\n");
}

export async function GET(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "true";

  const startMs = Date.now();

  const signals = await computeAllSignals(PAIRS);

  const newSignals = signals.filter((s) => s.isNewSignal);
  const errors = signals.filter((s) => s.error);

  let telegramSent = 0;
  let telegramFailed = 0;
  let telegramPublicSent = 0;
  let telegramPublicFailed = 0;

  const telegramConfig = await resolveTelegramConfig();
  const publicChatId = await resolvePublicChatId();

  for (const sig of newSignals) {
    if (!telegramConfig) break;

    const text = buildSignalMessage(sig.pair, sig.direction, sig.score, sig.price);
    const result = await sendToVipAndPublic(telegramConfig, publicChatId, text);

    if (result.vipOk) {
      telegramSent++;
    } else {
      telegramFailed++;
      // Bu satıra "if (!telegramConfig) break;" atlanmadan gelindi —
      // yapılandırma eksikliği değil, her zaman gerçek bir gönderim hatası.
      console.error(`[CRON signal-check] Telegram failed for ${sig.pair}:`, result.vipErrorMessage);
      Sentry.captureMessage("Telegram GO sinyali (VIP) gönderimi başarısız", {
        level: "warning",
        extra: { pair: sig.pair, errorMessage: result.vipErrorMessage },
      });
    }
    if (result.publicAttempted) {
      if (result.publicOk) {
        telegramPublicSent++;
      } else {
        telegramPublicFailed++;
        console.error(
          `[CRON signal-check] Public Telegram failed for ${sig.pair}:`,
          result.publicErrorMessage,
        );
        Sentry.captureMessage("Telegram GO sinyali (public) gönderimi başarısız", {
          level: "warning",
          extra: { pair: sig.pair, errorMessage: result.publicErrorMessage },
        });
      }
    }
  }

  // ── DB write: persist new GO signals (non-fatal — cron continues on error) ──
  let dbWritten = 0;
  for (const sig of newSignals) {
    try {
      await insertGoSignal({
        pair: sig.pair,
        direction: sig.direction,
        score: sig.score,
        effectiveThreshold: sig.effectiveThreshold,
        triggerPrice: sig.price,
        signalTs: sig.signalTs ?? startMs,
        pullbackActive: sig.pullbackActive ?? false,
        regime: sig.regime,
        sweepBonus: sig.sweepBonus ?? 0,
        regimeBonus: sig.regimeBonus ?? 0,
        blocks: sig.blocks ?? [],
        softBlocks: sig.softBlocks ?? [],
        sub: sig.sub,
      });
      dbWritten++;
    } catch (err) {
      console.error(`[CRON signal-check] DB write failed for ${sig.pair}:`, err);
    }
  }

  // ── DB write: persist a raw score snapshot for EVERY pair, GO/WAIT/NO
  // fark etmeksizin (go_signals'ın aksine — o sadece GO geçişlerini tutar).
  // Skor hesaplama mantığına dokunulmuyor, `signals` zaten computeAllSignals()
  // tarafından hesaplanmış — burada sadece o mevcut sonuç ek olarak
  // score_history'ye yazılıyor. Hata durumlarını (sig.error) atlıyoruz —
  // onlarda sub/regime/baseScore hiç yok (computeServerSignal'ın catch
  // dalı sadece pair/verdict/direction/score/price döner, bkz. signalEngine.ts).
  // Tek Supabase isteği (batch upsert) — ~9 pair için loop yerine tek
  // POST, 10sn cron bütçesini (Hobby plan) gereksiz zorlamaz.
  let scoreHistoryWritten = 0;
  try {
    const historyRows: ScoreHistoryInput[] = signals
      .filter((s) => !s.error && s.sub !== undefined && s.baseScore !== undefined)
      .map((s) => ({
        pair: s.pair,
        direction: s.direction,
        verdict: s.verdict,
        score: s.score,
        baseScore: s.baseScore as number,
        effectiveThreshold: s.effectiveThreshold,
        price: s.price,
        signalTs: s.signalTs ?? startMs,
        regime: s.regime,
        sweepBonus: s.sweepBonus ?? 0,
        regimeBonus: s.regimeBonus ?? 0,
        overextFlags: s.overextFlags ?? 0,
        srModifierRaw: s.srModifierRaw,
        srModifierApplied: s.srModifierApplied,
        // oiVelocityScore zaten oiVelocityScoreOrZero() ile null→0 çökertilmiş
        // geliyor (signalEngine.ts), yani ikisi bugün aynı değeri taşıyor —
        // orchestrator.ts'teki oiBonus=input.oiVelocityScore??0 formülüyle
        // isim/şema paritesi için ayrı tutuluyor. Asıl tanısal alan
        // oiSnapshotCount: cache çalışıyorsa zamanla 1'in üzerine çıkmalı.
        oiVelocityScore: s.debugInputs?.oiVelocityScore,
        oiBonus: s.debugInputs?.oiVelocityScore,
        oiSnapshotCount: s.oiSnapshotCount,
        blocks: s.blocks ?? [],
        softBlocks: s.softBlocks ?? [],
        sub: s.sub,
      }));
    await insertScoreHistoryBatch(historyRows);
    scoreHistoryWritten = historyRows.length;
  } catch (err) {
    console.error(`[CRON signal-check] score_history write failed:`, err);
  }

  // ── Outcome check: fill in outcome15m/outcome1h for past signals ──
  // (non-fatal — whole block wrapped so a Supabase hiccup never fails the
  // Telegram/score-check work above, which already completed by this point)
  let outcomesWritten = 0;
  let outcomesNotified = 0;
  let outcomesNotifyFailed = 0;
  let outcomesNotifiedPublic = 0;
  let outcomesNotifyFailedPublic = 0;
  try {
    const [pending15m, pending1h] = await Promise.all([
      getSignalsPendingOutcome("15m", startMs, OUTCOME_15M_MIN_MS, OUTCOME_15M_MAX_MS),
      getSignalsPendingOutcome("1h", startMs, OUTCOME_1H_MIN_MS, OUTCOME_1H_MAX_MS),
    ]);

    if (pending15m.length > 0 || pending1h.length > 0) {
      const tickers = await fetch24hTickers(PAIRS);
      const res15m = await processOutcomeBatch(pending15m, "15m", tickers, startMs, telegramConfig, publicChatId);
      const res1h = await processOutcomeBatch(pending1h, "1h", tickers, startMs, telegramConfig, publicChatId);
      outcomesWritten += res15m.written + res1h.written;
      outcomesNotified += res15m.notified + res1h.notified;
      outcomesNotifyFailed += res15m.notifyFailed + res1h.notifyFailed;
      outcomesNotifiedPublic += res15m.notifiedPublic + res1h.notifiedPublic;
      outcomesNotifyFailedPublic += res15m.notifyFailedPublic + res1h.notifyFailedPublic;
    }
  } catch (err) {
    console.error(`[CRON signal-check] outcome check failed:`, err);
  }

  const elapsedMs = Date.now() - startMs;

  console.log(
    `[CRON signal-check] ${signals.length} pairs checked, ${newSignals.length} new GO signals,` +
      ` ${telegramSent} VIP sent (${telegramPublicSent} public), ${dbWritten} db written,` +
      ` ${scoreHistoryWritten} score_history written,` +
      ` ${outcomesWritten} outcomes written (${outcomesNotified} VIP notified, ${outcomesNotifiedPublic} public notified),` +
      ` ${errors.length} errors, ${elapsedMs}ms`,
  );

  return NextResponse.json({
    ok: true,
    checkedPairs: signals.length,
    goSignals: signals.filter((s) => s.verdict === "go").length,
    newSignals: newSignals.length,
    telegramSent,
    telegramFailed,
    telegramPublicSent,
    telegramPublicFailed,
    dbWritten,
    scoreHistoryWritten,
    outcomesWritten,
    outcomesNotified,
    outcomesNotifyFailed,
    outcomesNotifiedPublic,
    outcomesNotifyFailedPublic,
    errors: errors.map((e) => ({ pair: e.pair, error: e.error })),
    elapsedMs,
    ...(verbose && {
      allScores: signals.map((s) => ({
        pair: s.pair,
        verdict: s.verdict,
        score: s.score,
        direction: s.direction,
        price: s.price,
        isNewSignal: s.isNewSignal,
        ...s.debugInputs,
      })),
    }),
  });
}
