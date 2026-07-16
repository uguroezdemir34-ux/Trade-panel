/**
 * OKX CATCH-ALL PROXY — /api/okx/api/v5/... isteklerini karşılar.
 *
 * GET  /api/okx/api/v5/<path>?<query>
 *   Header: X-OKX-Mode: demo | prod
 *
 * POST /api/okx/api/v5/<path>
 *   Body: { isDemo: boolean, body: object }
 *
 * Güvenlik: OKX secret asla browser'a çıkmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleOkxProxy,
  loadServerConfigFromEnv,
} from "@/lib/okx/server-handler";
import { auth } from "@/lib/auth/serverStubs";
import { checkOkxRateLimit } from "@/lib/rate-limit";

function buildOkxPath(req: NextRequest): string {
  // URL: /api/okx/api/v5/market/candles?instId=...
  // OKX path: /api/v5/market/candles?instId=...
  const url = new URL(req.url);
  const afterProxy = url.pathname.replace(/^\/api\/okx/, "");
  return afterProxy + (url.search ?? "");
}

/**
 * Rate-limit anahtarı: giriş yapmış kullanıcı için Clerk userId (mobil
 * operatör NAT'ları/paylaşımlı IP'ler yüzünden IP güvenilmez), public/
 * unauthenticated market-data okumaları için (middleware.ts'te bu path'ler
 * isPublicRoute listesinde) X-Forwarded-For'a düşülür.
 */
async function rateLimitIdentifier(req: NextRequest): Promise<string> {
  const { userId } = await auth();
  if (userId) return userId;
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const identifier = await rateLimitIdentifier(req);
  const { success } = await checkOkxRateLimit(identifier);
  if (!success) {
    return NextResponse.json({ ok: false, err: "RATE_LIMITED" }, { status: 429 });
  }

  const path = buildOkxPath(req);
  const isDemo = req.headers.get("X-OKX-Mode") === "demo";
  const config = loadServerConfigFromEnv(process.env);

  // Layer 2: optional client creds from custom headers
  const clientKey = req.headers.get("X-OKX-Client-Key");
  const clientSecret = req.headers.get("X-OKX-Client-Secret");
  const clientPass = req.headers.get("X-OKX-Client-Pass");
  const clientCreds =
    clientKey && clientSecret && clientPass
      ? { key: clientKey, secret: clientSecret, pass: clientPass }
      : null;

  const result = await handleOkxProxy({ method: "GET", path, isDemo, clientCreds }, config);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const identifier = await rateLimitIdentifier(req);
  const { success } = await checkOkxRateLimit(identifier);
  if (!success) {
    return NextResponse.json({ ok: false, err: "RATE_LIMITED" }, { status: 429 });
  }

  let parsed: { isDemo?: boolean; body?: unknown; clientCreds?: { key: string; secret: string; pass: string } | null };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ ok: false, err: "INVALID_JSON" }, { status: 400 });
  }

  const path = buildOkxPath(req);
  const config = loadServerConfigFromEnv(process.env);

  // Layer 2: optional client creds from request body
  const clientCreds = parsed.clientCreds?.key ? parsed.clientCreds : null;

  const result = await handleOkxProxy(
    {
      // If no OKX body payload, this is a credential-authenticated read → use GET for OKX.
      // If body is present, it's an order/write operation → use POST.
      method: parsed.body !== undefined ? "POST" : "GET",
      path,
      body: parsed.body,
      isDemo: !!parsed.isDemo,
      clientCreds,
    },
    config,
  );
  return NextResponse.json(result);
}
