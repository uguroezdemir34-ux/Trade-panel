/**
 * GATE.IO FUTURES PROXY — /api/gateio isteklerini Gate.io v4 API'ye iletir.
 *
 * POST /api/gateio
 *   Body: { path: "/api/v4/futures/usdt/...", params: {...}, clientCreds?: {...} }
 *
 * Kapsam: SADECE GET/görüntüleme — API secret asla browser'a çıkmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleGateioProxy,
  loadGateioConfigFromEnv,
} from "@/lib/gateio/server-handler";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: {
    path?: string;
    params?: Record<string, unknown>;
    clientCreds?: { key: string; secret: string } | null;
  };

  try {
    parsed = await req.json() as typeof parsed;
  } catch {
    return NextResponse.json({ ok: false, label: "INVALID_JSON" }, { status: 400 });
  }

  if (!parsed.path || typeof parsed.path !== "string") {
    return NextResponse.json({ ok: false, label: "MISSING_PATH" }, { status: 400 });
  }

  if (!parsed.path.startsWith("/api/v4/futures/usdt/")) {
    return NextResponse.json({ ok: false, label: "INVALID_PATH" }, { status: 400 });
  }

  const config = loadGateioConfigFromEnv(process.env);
  const clientCreds =
    parsed.clientCreds?.key && parsed.clientCreds?.secret
      ? { key: parsed.clientCreds.key, secret: parsed.clientCreds.secret }
      : null;

  const result = await handleGateioProxy(
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
