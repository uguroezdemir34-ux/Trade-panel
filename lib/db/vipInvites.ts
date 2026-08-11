/**
 * VIP TELEGRAM INVITE DB HELPER — server-only.
 *
 * vip_telegram_invites (migration 023). Tek amaç: Stripe webhook'unun
 * aynı kullanıcı için ikinci kez tetiklendiğinde (checkout.session.completed
 * + hemen ardından customer.subscription.updated gibi) yeni bir davet
 * linki ÜRETMEMESİ — link bir kez üretilir, sonra hep aynısı okunur.
 */

import { dbSelect, dbUpsert, isDbConfigured } from "./server";

export interface VipInviteRow {
  user_id: string;
  invite_link: string;
  created_at: string;
}

/** @returns null hem "Supabase yapılandırılmamış" hem "satır yok" durumunda — çağıran ayrımı isDbConfigured() ile ayrıca yapabilir. */
export async function getVipInviteLink(userId: string): Promise<string | null> {
  if (!isDbConfigured()) return null;
  const rows = await dbSelect<VipInviteRow>(
    "vip_telegram_invites",
    `user_id=eq.${encodeURIComponent(userId)}&select=invite_link`,
  );
  return rows[0]?.invite_link ?? null;
}

export async function saveVipInviteLink(userId: string, inviteLink: string): Promise<void> {
  if (!isDbConfigured()) return;
  await dbUpsert("vip_telegram_invites", { user_id: userId, invite_link: inviteLink }, "user_id");
}
