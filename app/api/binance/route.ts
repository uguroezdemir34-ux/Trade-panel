/**
 * BINANCE FAPI PROXY — /api/binance/** isteklerini Binance FAPI'ye iletir.
 *
 * POST /api/binance
 *   Body: { path: "/fapi/v1/...", method: "GET"|"POST"|"DELETE", params: {...}, clientCreds?: {...} }
 *
 * API secret asla browser'a çıkmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleBinanceProxy,
  loadBinanceConfigFromEnv,
  type BinanceProxyRequest,
} from "@/lib/binance/server-handler";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: {
    path?: string;
    method?: string;
    params?: Record<string, string | number | boolean>;
    clientCreds?: { key: string; secret: string } | null;
  };

  try {
    parsed = await req.json() as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, msg: "INVALID_JSON" }, { status: 400 });
  }

  if (!parsed.path || typeof parsed.path !== "string") {
    return NextResponse.json({ ok: false, msg: "MISSING_PATH" }, { status: 400 });
  }

  const method = (parsed.method ?? "POST") as BinanceProxyRequest["method"];
  if (!["GET", "POST", "DELETE"].includes(method)) {
    return NextResponse.json({ ok: false, msg: "INVALID_METHOD" }, { status: 400 });
  }

  const config = loadBinanceConfigFromEnv(process.env);
  const clientCreds =
    parsed.clientCreds?.key && parsed.clientCreds?.secret
      ? { key: parsed.clientCreds.key, secret: parsed.clientCreds.secret }
      : null;

  const result = await handleBinanceProxy(
    {
      method,
      path: parsed.path,
      params: parsed.params,
      clientCreds,
    },
    config,
  );

  return NextResponse.json(result);
}
