import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { getVipInviteLink } from "@/lib/db/vipInvites";

/**
 * VIP TELEGRAM DAVET LİNKİ — kullanıcının kendi (varsa) linkini döner.
 *
 * Link, Stripe webhook'unun checkout.session.completed/subscription.updated
 * event'lerinde ÜRETİLİP saklanmıştı (bkz. app/api/stripe/webhook/route.ts
 * → ensureVipInviteLink). Burada SADECE okunur, hiçbir üretim/tekrar
 * deneme mantığı yok — kullanıcı Pro ama link yoksa (webhook adımı
 * başarısız oldu ya da TELEGRAM_VIP_COMMUNITY_CHAT_ID henüz kurulmadı),
 * inviteLink: null döner; UI tarafı (VipInviteCard) bunu sessizce boş
 * göstermek yerine görünür bir "henüz hazır değil" durumuyla ele alır
 * (CLAUDE.md §0.1: emin değilse sessiz fallback yerine görünür durum).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inviteLink = await getVipInviteLink(userId);
  return NextResponse.json({ inviteLink });
}
