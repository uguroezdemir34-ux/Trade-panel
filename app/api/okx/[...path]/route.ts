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

function buildOkxPath(req: NextRequest): string {
  // URL: /api/okx/api/v5/market/candles?instId=...
  // OKX path: /api/v5/market/candles?instId=...
  const url = new URL(req.url);
  const afterProxy = url.pathname.replace(/^\/api\/okx/, "");
  return afterProxy + (url.search ?? "");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
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
    { method: "POST", path, body: parsed.body, isDemo: !!parsed.isDemo, clientCreds },
    config,
  );
  return NextResponse.json(result);
}
