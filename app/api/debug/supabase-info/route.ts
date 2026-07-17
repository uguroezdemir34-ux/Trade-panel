/**
 * [DEBUG] GEÇİCİ TEŞHİS ENDPOINT'İ — Vercel'in Supabase env var'larının
 * gerçekte hangi projeye bağlı olduğunu ve `trades` tablosunun orada
 * var olup olmadığını doğrudan tarayıcıdan görmek için (Vercel mobil
 * panelinde Sensitive env var değeri açılamadı). Giriş yapılmış olmayı
 * gerektirir. Teşhis bitince silinecek.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    return NextResponse.json({ configured: false, host: null, tradesTableExists: null });
  }

  let host: string | null = null;
  try {
    host = new URL(url).host;
  } catch {
    host = "INVALID_URL";
  }

  let tradesTableExists: boolean | null = null;
  if (serviceKey) {
    try {
      const res = await fetch(`${url}/rest/v1/trades?select=id&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      tradesTableExists = res.ok;
    } catch {
      tradesTableExists = null;
    }
  }

  return NextResponse.json({ configured: true, host, tradesTableExists });
}
