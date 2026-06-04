/**
 * PUSH SUBSCRIPTION DB — Supabase'de push subscription'ları yönet.
 *
 * Graceful degradation: Supabase konfigüre edilmemişse
 * in-memory fallback (restart'ta sıfırlanır, geliştirme/test için).
 */

import { dbSelect, dbUpsert, dbDelete, isDbConfigured } from "@/lib/db/server";

export interface PushSubscriptionRow {
  /** endpoint URL — primary key */
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}

const memStore: PushSubscriptionRow[] = [];

export async function saveSubscription(row: PushSubscriptionRow): Promise<void> {
  if (!isDbConfigured()) {
    const idx = memStore.findIndex((s) => s.endpoint === row.endpoint);
    if (idx >= 0) memStore[idx] = row;
    else memStore.push(row);
    return;
  }
  await dbUpsert<PushSubscriptionRow>("push_subscriptions", row);
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  if (!isDbConfigured()) {
    const idx = memStore.findIndex((s) => s.endpoint === endpoint);
    if (idx >= 0) memStore.splice(idx, 1);
    return;
  }
  await dbDelete(
    "push_subscriptions",
    `endpoint=eq.${encodeURIComponent(endpoint)}`,
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
