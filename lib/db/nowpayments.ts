/**
 * NOWPAYMENTS DB HELPER — server-side only.
 *
 * process_nowpayments_ipn RPC'sini (migration 017) çağırır — idempotency
 * kontrolü + event insert + subscription upsert TEK Postgres transaction'ında
 * yapılır. Clerk senkronu BİLEREK burada yok, webhook route'u bu fonksiyon
 * başarıyla dönünce Clerk'i ayrı bir adım olarak çağırıyor (dış API çağrısı
 * bir DB transaction'ın içine konulmaz — yarıda kalırsa güvenle yeniden
 * denenebilsin diye).
 */

import { dbRpc, dbSelect, dbUpdate, isDbConfigured } from "./server";

export interface NowPaymentsSubscription {
  user_id: string;
  plan: "free" | "pro";
  status: "inactive" | "active" | "expired";
  current_period_end: string | null;
  last_payment_id: string | null;
  last_event_id: string | null;
}

interface ProcessIpnResult {
  already_processed: boolean;
  plan: "free" | "pro" | null;
}

/**
 * @returns already_processed=true ise webhook route Clerk senkronunu
 * ATLAMALI (idempotent tekrar teslimat — event zaten işlenmişti).
 */
export async function processNowPaymentsIpn(params: {
  eventId: string;
  paymentId: string;
  userId: string;
  status: string;
  payload: unknown;
  /** null = ara durum (waiting/confirming/sending) — event kaydedilir ama
   *  subscription tablosuna dokunulmaz (bkz. migration 017 RPC gövdesi). */
  newPlan: "free" | "pro" | null;
  periodEnd: string | null;
}): Promise<ProcessIpnResult> {
  const [result] = await dbRpc<ProcessIpnResult[]>("process_nowpayments_ipn", {
    p_event_id: params.eventId,
    p_payment_id: params.paymentId,
    p_user_id: params.userId,
    p_status: params.status,
    p_payload: params.payload,
    p_new_plan: params.newPlan,
    p_period_end: params.periodEnd,
  });
  return result;
}

/** Tek kullanıcının abonelik durumunu okur — checkout route'unda "zaten pro mu" kontrolü için. */
export async function getNowPaymentsSubscription(userId: string): Promise<NowPaymentsSubscription | null> {
  if (!isDbConfigured()) return null;
  const rows = await dbSelect<NowPaymentsSubscription>(
    "nowpayments_subscriptions",
    `user_id=eq.${encodeURIComponent(userId)}`,
  );
  return rows[0] ?? null;
}

/**
 * Süresi dolmuş (current_period_end geçmiş) ama hâlâ 'active' işaretli
 * abonelikleri döner — /api/cron/daily-summary'deki izole kontrol bunları
 * free'ye düşürür. SADECE düşürme amaçlı okunuyor; uzatma/yükseltme bu
 * fonksiyondan asla yapılmaz (o, yalnızca doğrulanmış IPN ile olur).
 */
export async function getExpiredActiveSubscriptions(): Promise<NowPaymentsSubscription[]> {
  if (!isDbConfigured()) return [];
  const nowIso = new Date().toISOString();
  return dbSelect<NowPaymentsSubscription>(
    "nowpayments_subscriptions",
    `status=eq.active&current_period_end=lt.${encodeURIComponent(nowIso)}`,
  );
}

/**
 * Süresi dolmuş bir aboneliği free'ye düşürür — SADECE cron tarafından,
 * SADECE current_period_end geçmiş 'active' kayıtlar için çağrılır (bkz.
 * getExpiredActiveSubscriptions). Uzatma/yükseltme bu dosyadan asla
 * yapılmaz.
 */
export async function markSubscriptionExpired(userId: string): Promise<void> {
  if (!isDbConfigured()) return;
  await dbUpdate<NowPaymentsSubscription>(
    "nowpayments_subscriptions",
    { plan: "free", status: "expired" },
    `user_id=eq.${encodeURIComponent(userId)}`,
  );
}
