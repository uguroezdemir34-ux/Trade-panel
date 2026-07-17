/**
 * GET /api/admin/waitlist — waitlist'teki tüm kayıtları döner.
 * Admin-only (bkz. lib/auth/admin.ts). Beta-gated route DEĞİL, kendi
 * kontrolünü kendi yapıyor.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { isAdminUserId } from "@/lib/auth/admin";
import { dbSelect, isDbConfigured } from "@/lib/db/server";

interface WaitlistRow {
  id: number;
  email: string;
  referral_code: string;
  referred_by: string | null;
  status: string;
  created_at: string;
}

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!isAdminUserId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ rows: [] });
  }

  try {
    const rows = await dbSelect<WaitlistRow>("waitlist", "order=id.asc");
    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[/api/admin/waitlist]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
