/**
 * GET /api/waitlist/status — signed-in kullanıcının kendi waitlist
 * pozisyonunu (ve referral kodunu) döner.
 *
 * Auth GEREKLİ (bkz. middleware.ts — /api/waitlist/status bilerek
 * isPublicRoute'ta DEĞİL, sadece /api/waitlist/register orada). E-posta
 * client'tan alınmıyor — sahtecilik riskini önlemek için Clerk'in
 * `currentUser()`'ından (sunucu tarafı, oturum sahibinin gerçek e-postası)
 * okunuyor, sonra `waitlist` tablosunda o email aranıyor.
 *
 * referralCode — ReferralCard.tsx (ayarlar) için eklendi. Waitlist kaydı
 * hiç yoksa (ör. hesap admin tarafından doğrudan açıldıysa) `null` döner —
 * bu durumda kart hiç render edilmez, uydurma bir kod GÖSTERİLMEZ.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/auth/serverStubs";
import { dbSelect, isDbConfigured } from "@/lib/db/server";

interface WaitlistRow {
  id: number;
  status: string;
  referral_code: string;
}

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ position: null, referralCode: null });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ position: null, referralCode: null });
  }

  try {
    const rows = await dbSelect<WaitlistRow>(
      "waitlist",
      `email=eq.${encodeURIComponent(email)}&select=id,status,referral_code`,
    );
    if (rows.length === 0) {
      return NextResponse.json({ position: null, referralCode: null });
    }
    return NextResponse.json({
      position: rows[0].id,
      status: rows[0].status,
      referralCode: rows[0].referral_code,
    });
  } catch (err) {
    console.error("[/api/waitlist/status]", err);
    // Waitlist bulunamaması hard bir hata değil — sessizce "kayıt yok" gibi davran.
    return NextResponse.json({ position: null, referralCode: null });
  }
}
