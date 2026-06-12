/**
 * BYBIT V5 PROXY — /api/bybit isteklerini Bybit V5 API'ye iletir.
 *
 * POST /api/bybit
 *   Body: { path: "/v5/...", method: "GET"|"POST", params: {...}, clientCreds?: {...} }
 *
 * API secret asla browser'a çıkmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleBybitProxy,
  loadBybitConfigFromEnv,
  type BybitProxyRequest,
} from "@/lib/bybit/server-handler";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: {
    path?: string;
    method?: string;
    params?: Record<string, unknown>;
    clientCreds?: { key: string; secret: string } | null;
  };

  try {
    parsed = await req.json() as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, retMsg: "INVALID_JSON" }, { status: 400 });
  }

  if (!parsed.path || typeof parsed.path !== "string") {
    return NextResponse.json({ ok: false, retMsg: "MISSING_PATH" }, { status: 400 });
  }

  if (!parsed.path.startsWith("/v5/")) {
    return NextResponse.json({ ok: false, retMsg: "INVALID_PATH" }, { status: 400 });
  }

  const method = (parsed.method ?? "POST") as BybitProxyRequest["method"];
  if (!["GET", "POST"].includes(method)) {
    return NextResponse.json({ ok: false, retMsg: "INVALID_METHOD" }, { status: 400 });
  }

  const config = loadBybitConfigFromEnv(process.env);
  const clientCreds =
    parsed.clientCreds?.key && parsed.clientCreds?.secret
      ? { key: parsed.clientCreds.key, secret: parsed.clientCreds.secret }
      : null;

  const result = await handleBybitProxy(
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
