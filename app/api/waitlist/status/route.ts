/**
 * GET /api/waitlist/status — signed-in kullanıcının kendi waitlist
 * pozisyonunu döner.
 *
 * Auth GEREKLİ (bkz. middleware.ts — /api/waitlist/status bilerek
 * isPublicRoute'ta DEĞİL, sadece /api/waitlist/register orada). E-posta
 * client'tan alınmıyor — sahtecilik riskini önlemek için Clerk'in
 * `currentUser()`'ından (sunucu tarafı, oturum sahibinin gerçek e-postası)
 * okunuyor, sonra `waitlist` tablosunda o email aranıyor.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@/lib/auth/serverStubs";
import { dbSelect, isDbConfigured } from "@/lib/db/server";

interface WaitlistRow {
  id: number;
  status: string;
}

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ position: null });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ position: null });
  }

  try {
    const rows = await dbSelect<WaitlistRow>(
      "waitlist",
      `email=eq.${encodeURIComponent(email)}&select=id,status`,
    );
    if (rows.length === 0) {
      return NextResponse.json({ position: null });
    }
    return NextResponse.json({ position: rows[0].id, status: rows[0].status });
  } catch (err) {
    console.error("[/api/waitlist/status]", err);
    // Waitlist bulunamaması hard bir hata değil — sessizce "kayıt yok" gibi davran.
    return NextResponse.json({ position: null });
  }
}
