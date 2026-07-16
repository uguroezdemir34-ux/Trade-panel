/**
 * PUSH SUBSCRIPTION DB — Supabase'de push subscription'ları yönet.
 *
 * İki platform: "webpush" (tarayıcı/PWA, endpoint+p256dh+auth) ve "fcm"
 * (Capacitor/Android native, sadece token). PK artık server-generated
 * `id` — doğal anahtar (endpoint ya da token) upsert'te on_conflict
 * hedefi olarak açıkça belirtilir (bkz. dbUpsert).
 *
 * Graceful degradation: Supabase konfigüre edilmemişse
 * in-memory fallback (restart'ta sıfırlanır, geliştirme/test için).
 */

import { dbSelect, dbUpsert, dbDelete, isDbConfigured } from "@/lib/db/server";

export type PushPlatform = "webpush" | "fcm";

export interface PushSubscriptionRow {
  user_id: string;
  platform: PushPlatform;
  /** webpush: abonelik URL'i. fcm: null. */
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  /** fcm: cihaz token'ı. webpush: null. */
  token: string | null;
}

const memStore: PushSubscriptionRow[] = [];

function identityOf(row: Pick<PushSubscriptionRow, "endpoint" | "token">): string {
  const id = row.endpoint ?? row.token;
  if (!id) throw new Error("PushSubscriptionRow: endpoint veya token gerekli");
  return id;
}

export async function saveSubscription(row: PushSubscriptionRow): Promise<void> {
  const identity = identityOf(row);
  if (!isDbConfigured()) {
    const idx = memStore.findIndex((s) => identityOf(s) === identity);
    if (idx >= 0) memStore[idx] = row;
    else memStore.push(row);
    return;
  }
  const onConflict = row.platform === "fcm" ? "token" : "endpoint";
  await dbUpsert<PushSubscriptionRow>("push_subscriptions", row, onConflict);
}

/** @param identity endpoint URL'i (webpush) veya token (fcm) */
export async function deleteSubscription(identity: string): Promise<void> {
  if (!isDbConfigured()) {
    const idx = memStore.findIndex((s) => identityOf(s) === identity);
    if (idx >= 0) memStore.splice(idx, 1);
    return;
  }
  await dbDelete(
    "push_subscriptions",
    `or=(endpoint.eq.${encodeURIComponent(identity)},token.eq.${encodeURIComponent(identity)})`,
  );
}

export async function getAllSubscriptions(): Promise<PushSubscriptionRow[]> {
  if (!isDbConfigured()) return [...memStore];
  return dbSelect<PushSubscriptionRow>("push_subscriptions", "");
}

export async function getUserSubscriptions(
  userId: string,
): Promise<PushSubscriptionRow[]> {
  if (!isDbConfigured()) {
    return memStore.filter((s) => s.user_id === userId);
  }
  return dbSelect<PushSubscriptionRow>(
    "push_subscriptions",
    `user_id=eq.${encodeURIComponent(userId)}`,
  );
}
