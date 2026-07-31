/**
 * GET /api/admin/whoami — "bu kullanıcı admin mi" boolean'ı döner, başka
 * hiçbir veri yok. components/ayarlar/AdminPanelCard.tsx bunu kullanıp
 * "Yönetici Paneli" linkini koşullu render ediyor.
 *
 * ADMIN_USER_IDS env var'ı (bkz. lib/auth/admin.ts) bilerek client'a hiç
 * sızmıyor — client sadece bu server-side round-trip'in sonucunu (true/
 * false) görür. middleware.ts zaten "/api/admin(.*)" için aynı
 * isAdminUserId() kontrolünü Edge seviyesinde yapıp admin olmayanı 403'e
 * düşürüyor (bkz. isAdminApiRoute) — buradaki kontrol ikinci savunma
 * katmanı, app/api/admin/waitlist/route.ts ile aynı desen.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { isAdminUserId } from "@/lib/auth/admin";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!isAdminUserId(userId)) {
    return NextResponse.json({ isAdmin: false }, { status: 403 });
  }
  return NextResponse.json({ isAdmin: true });
}
