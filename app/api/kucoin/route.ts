/**
 * KUCOIN FUTURES PROXY — /api/kucoin isteklerini KuCoin Futures API'ye iletir.
 *
 * POST /api/kucoin
 *   Body: { path: "/api/v1/positions" | "/api/v1/account-overview", params: {...}, clientCreds?: {...} }
 *
 * Kapsam: SADECE GET/görüntüleme — API secret asla browser'a çıkmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleKucoinProxy,
  loadKucoinConfigFromEnv,
} from "@/lib/kucoin/server-handler";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: {
    path?: string;
    params?: Record<string, unknown>;
    clientCreds?: { key: string; secret: string; passphrase: string } | null;
  };

  try {
    parsed = await req.json() as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON" }, { status: 400 });
  }

  if (!parsed.path || typeof parsed.path !== "string") {
    return NextResponse.json({ ok: false, code: "MISSING_PATH" }, { status: 400 });
  }

  // İkinci savunma katmanı — server-handler.ts'teki exact allow-list'in
  // tekrarı (Bybit/Gate.io route.ts'lerindeki aynı defense-in-depth deseni).
  if (parsed.path !== "/api/v1/positions" && parsed.path !== "/api/v1/account-overview") {
    return NextResponse.json({ ok: false, code: "INVALID_PATH" }, { status: 400 });
  }

  const config = loadKucoinConfigFromEnv(process.env);
  const clientCreds =
    parsed.clientCreds?.key && parsed.clientCreds?.secret && parsed.clientCreds?.passphrase
      ? {
          key: parsed.clientCreds.key,
          secret: parsed.clientCreds.secret,
          passphrase: parsed.clientCreds.passphrase,
        }
      : null;

  const result = await handleKucoinProxy(
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
