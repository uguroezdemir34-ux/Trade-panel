/**
 * NOTIFY CHANNEL — Bildirim kanallarının ortak interface'i.
 *
 * Dolu impl: lib/notify/telegram.ts (paket #9)
 * İskelet: discord, email, sms (gelecek)
 *
 * Bkz. ARCHITECTURE.md bölüm 6.
 */

import type { Pair } from "@/lib/constants/pairs";
import type { ScoreSubScores } from "@/lib/score/orchestrator";
import type { HumanTraderCheckResult } from "@/lib/signal/humanTraderCheck";
import type { TelegramConfig } from "./telegram/config";

// ═══════════════ CHANNEL NAME ═══════════════

export type ChannelName = "telegram" | "discord" | "webhook" | "email";

export const SUPPORTED_CHANNELS: readonly ChannelName[] = [
  "telegram",
  "discord",
  "webhook",
  "email",
];

// ═══════════════ NOTIFY MESSAGE ═══════════════

/**
 * Bildirim tipi — orchestrator → channel'a hangi olay için mesaj.
 */
export type NotifyKind =
  | "trade_opened"
  | "trade_closed"
  | "sl_hit"
  | "tp_hit"
  | "lock_triggered"
  | "go_signal"
  | "price_alarm"
  | "score_momentum"
  | "consecutive_loss"
  | "sl_proximity"  // SL yaklaştığında veya ihlal uyarısı
  | "position_risk_violation" // kaldıraç/SL guardrail ihlali (lib/risk/positionGuardrails.ts)
  | "test"; // health check

/**
 * Mesaj payload — channel kendi formatına çevirir.
 */
export interface NotifyMessage {
  kind: NotifyKind;
  pair?: Pair;
  direction?: "LONG" | "SHORT";
  entry?: number;
  stopPrice?: number;
  tp1?: number;
  tp2?: number;
  /** Sinyalin gerekçesi (kısa, insanca) */
  reasonText?: string;
  /** Skor 0-100 */
  score?: number;
  /** Skor artışı (momentum alert için) */
  rise?: number;
  /** Ardışık zarar sayısı */
  streak?: number;
  /** Uyarı seviyesi (consecutive_loss için) */
  severity?: string;
  /** Ek bilgi (PnL kapanışta vb.) */
  pnl?: number;
  pnlPct?: number;
  /** Mesaj zamanı (epoch ms) — channel format'lar */
  timestamp?: number;
  /** 8 kategori ham skoru — sadece Telegram paylaşım kartı (route.ts →
   *  exportShareCardPngServer) için, diğer channel'lar (Discord/Webhook)
   *  yoksayar. trade_opened dışında hiçbir kind bunu doldurmuyor. */
  sub?: ScoreSubScores;
  /** checkHumanTraderApprovalAtFireTime()'ın (lib/signal/humanTraderCheck.ts)
   *  sinyal ateşlenme anındaki TAZE sonucu — sadece Telegram route'unun
   *  (app/api/telegram/signal/route.ts) anlatım metni üretmesi + S/R/hacim/
   *  R:R sayısal detaylarını mesaja eklemesi için. trade_opened (useSignalFirehose.ts)
   *  ve go_signal (useGoAlerts.ts) dışında hiçbir kind bunu doldurmuyor —
   *  ikisi de bu noktaya SADECE onaylanmış (verdict zaten "go") sinyaller
   *  için ulaşıyor (bkz. useScoreEngine.ts/signalEngine.ts entegrasyonu),
   *  yani bu alan hiçbir zaman "reddedilmiş bir sinyalin detayı" taşımaz —
   *  fire-time'da TAZE hesaplanan bir gözlem, verdict'i tekrar etkilemiyor.
   *  Diğer channel'lar (Discord/Webhook) yoksayar. */
  humanCheck?: HumanTraderCheckResult;
}

// ═══════════════ RESULT ═══════════════

export interface NotifyResult {
  ok: boolean;
  /** Channel adı (audit için) */
  channel: ChannelName;
  /** Channel-specific mesaj/hata */
  errorMessage?: string;
  /** Channel'ın döndüğü kimlik (örn. Telegram message_id) */
  messageId?: string;
}

// ═══════════════ CHANNEL INTERFACE ═══════════════

export interface NotifyChannel {
  readonly name: ChannelName;

  /** Channel dolu mu yoksa iskelet mi? */
  readonly isImplemented: boolean;

  /** Config tamam mı (.env.local doldurulmuş mu)? */
  isConfigured(): boolean;

  /** Mesaj gönder */
  send(msg: NotifyMessage): Promise<NotifyResult>;
}

// ═══════════════ CONFIG ═══════════════

export interface BaseChannelConfig {
  fetchFn?: typeof fetch;
  /**
   * telegram: env yerine bu config kullanılır (Layer 2 client creds).
   * NOT: registry.ts'in createChannel("telegram") yolu SADECE server-side
   * anlamlı — Next.js client bundle'ında process.env.TELEGRAM_BOT_TOKEN
   * hiç resolve olmaz. Client-side dispatch (lib/notify/dispatch.ts) bu
   * yüzden Telegram için bu değil, /api/telegram/signal route'unu kullanır.
   */
  telegramConfigOverride?: TelegramConfig | null;
  /** discord/webhook: hedef URL — yoksa/boşsa kanal "not configured" sayılır. */
  webhookUrl?: string | null;
}

// ═══════════════ HELPER ═══════════════

/**
 * "Not implemented" sonucu — iskelet channel'lar için.
 */
export function notImplementedResult(channel: ChannelName): NotifyResult {
  return {
    ok: false,
    channel,
    errorMessage: `${channel} channel not implemented yet`,
  };
}

/**
 * "Not configured" sonucu — channel var ama config eksik.
 */
export function notConfiguredResult(channel: ChannelName): NotifyResult {
  return {
    ok: false,
    channel,
    errorMessage: `${channel} channel not configured (check .env.local)`,
  };
}
