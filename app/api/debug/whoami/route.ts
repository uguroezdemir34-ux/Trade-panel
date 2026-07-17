/**
 * GEÇİCİ DEBUG ENDPOINT — ADMIN_USER_IDS eşleşme sorununu teşhis etmek için.
 * Sadece o an giriş yapmış kullanıcının Clerk userId'sini ve ADMIN_USER_IDS
 * env var'ının o an sunucuda gördüğü ham değeri döner. İş bitince silinecek
 * (bkz. daha önceki /api/debug/supabase-info deseni — aynı şekilde geçici).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  const rawAdminIds = process.env.ADMIN_USER_IDS ?? null;

  return NextResponse.json({
    yourUserId: userId,
    adminUserIdsEnvRaw: rawAdminIds,
    adminUserIdsParsed: (rawAdminIds ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    isMatch: userId
      ? (rawAdminIds ?? "").split(",").map((id) => id.trim()).includes(userId)
      : false,
  });
}
