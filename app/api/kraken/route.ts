/**
 * KRAKEN FUTURES PROXY — /api/kraken isteklerini Kraken Futures API'ye iletir.
 *
 * POST /api/kraken
 *   Body: { path: "/derivatives/api/v3/openpositions" | "/derivatives/api/v3/accounts" | "/derivatives/api/v3/tickers", params: {...}, clientCreds?: {...} }
 *
 * Kapsam: SADECE GET/görüntüleme — API secret asla browser'a çıkmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleKrakenProxy,
  loadKrakenConfigFromEnv,
} from "@/lib/kraken/server-handler";

const ALLOWED_PATHS = [
  "/derivatives/api/v3/openpositions",
  "/derivatives/api/v3/accounts",
  "/derivatives/api/v3/tickers",
];

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: {
    path?: string;
    params?: Record<string, unknown>;
    clientCreds?: { key: string; secret: string } | null;
  };

  try {
    parsed = await req.json() as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!parsed.path || typeof parsed.path !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_PATH" }, { status: 400 });
  }

  // İkinci savunma katmanı — server-handler.ts'teki exact allow-list'in tekrarı.
  if (!ALLOWED_PATHS.includes(parsed.path)) {
    return NextResponse.json({ ok: false, error: "INVALID_PATH" }, { status: 400 });
  }

  const config = loadKrakenConfigFromEnv(process.env);
  const clientCreds =
    parsed.clientCreds?.key && parsed.clientCreds?.secret
      ? { key: parsed.clientCreds.key, secret: parsed.clientCreds.secret }
      : null;

  const result = await handleKrakenProxy(
    {
      method: "GET",
      path: parsed.path,
      params: parsed.params,
      clientCreds,
    },
    config,
  );

  return NextResponse.json(result);
}
