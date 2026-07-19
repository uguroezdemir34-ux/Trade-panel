/**
 * MEXC FUTURES PROXY — /api/mexc isteklerini MEXC Futures API'ye iletir.
 *
 * POST /api/mexc
 *   Body: { path: "/api/v1/private/position/open_positions" | "/api/v1/private/account/assets" | "/api/v1/contract/detail", params: {...}, clientCreds?: {...} }
 *
 * Kapsam: SADECE GET/görüntüleme — API secret asla browser'a çıkmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleMexcProxy,
  loadMexcConfigFromEnv,
} from "@/lib/mexc/server-handler";

const ALLOWED_PATHS = [
  "/api/v1/private/position/open_positions",
  "/api/v1/private/account/assets",
  "/api/v1/contract/detail",
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
    return NextResponse.json({ ok: false, message: "INVALID_JSON" }, { status: 400 });
  }

  if (!parsed.path || typeof parsed.path !== "string") {
    return NextResponse.json({ ok: false, message: "MISSING_PATH" }, { status: 400 });
  }

  // İkinci savunma katmanı — server-handler.ts'teki exact allow-list'in tekrarı.
  if (!ALLOWED_PATHS.includes(parsed.path)) {
    return NextResponse.json({ ok: false, message: "INVALID_PATH" }, { status: 400 });
  }

  const config = loadMexcConfigFromEnv(process.env);
  const clientCreds =
    parsed.clientCreds?.key && parsed.clientCreds?.secret
      ? { key: parsed.clientCreds.key, secret: parsed.clientCreds.secret }
      : null;

  const result = await handleMexcProxy(
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
