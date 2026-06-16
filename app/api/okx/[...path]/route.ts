/**
 * OKX CATCH-ALL PROXY — /api/okx/api/v5/... isteklerini karşılar.
 *
 * GET  /api/okx/api/v5/<path>?<query>
 *   Header: X-OKX-Mode: demo | prod
 *
 * POST /api/okx/api/v5/<path>
 *   Body: { isDemo: boolean, body: object }
 *
 * Credential priority (server-side only — OKX secret never reaches browser):
 *   Layer 1: Vercel env vars (OKX_API_KEY / OKX_API_SECRET / OKX_API_PASSPHRASE)
 *   Layer 2: Clerk privateMetadata — decrypted server-side with EXCHANGE_CREDS_KEY
 *   Layer 3: Client-supplied headers (legacy / Binance/Bybit compat path)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  handleOkxProxy,
  loadServerConfigFromEnv,
} from "@/lib/okx/server-handler";
import type { OkxCredentials } from "@/lib/okx/auth";
import { auth } from "@/lib/auth/serverStubs";

function buildOkxPath(req: NextRequest): string {
  const url = new URL(req.url);
  const afterProxy = url.pathname.replace(/^\/api\/okx/, "");
  return afterProxy + (url.search ?? "");
}

/** Load OKX credentials from Clerk user privateMetadata (server-side, never returned to client). */
async function loadCredsFromClerk(
  userId: string,
  isDemo: boolean,
): Promise<OkxCredentials | null> {
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const { decryptCreds }  = await import("@/lib/server/encryptCreds");
    const client = await clerkClient();
    const user   = await client.users.getUser(userId);
    const meta   = (user.privateMetadata ?? {}) as Record<string, unknown>;
    const metaKey = isDemo ? "okxDemo" : "okxProd";
    const encrypted = meta[metaKey];
    if (typeof encrypted !== "string" || encrypted.length === 0) return null;
    const json  = decryptCreds(encrypted);
    const creds = JSON.parse(json) as { key: string; secret: string; pass: string };
    if (!creds.key || !creds.secret || !creds.pass) return null;
    return creds;
  } catch {
    // EXCHANGE_CREDS_KEY not set, Clerk not configured, or tampered data — fail silently
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const path    = buildOkxPath(req);
  const isDemo  = req.headers.get("X-OKX-Mode") === "demo";
  const config  = loadServerConfigFromEnv(process.env);

  // Layer 3: legacy client-supplied headers (kept for backward compat)
  const clientKey    = req.headers.get("X-OKX-Client-Key");
  const clientSecret = req.headers.get("X-OKX-Client-Secret");
  const clientPass   = req.headers.get("X-OKX-Client-Pass");
  let clientCreds: OkxCredentials | null =
    clientKey && clientSecret && clientPass
      ? { key: clientKey, secret: clientSecret, pass: clientPass }
      : null;

  // Layer 2: Clerk metadata — only when Layer 1 absent and no client creds
  if (!config.okxApiKey && !clientCreds) {
    try {
      const { userId } = await auth();
      if (userId) clientCreds = await loadCredsFromClerk(userId, isDemo);
    } catch {
      // auth() throws when Clerk is not configured — ignore
    }
  }

  const result = await handleOkxProxy({ method: "GET", path, isDemo, clientCreds }, config);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let parsed: {
    isDemo?: boolean;
    body?: unknown;
    clientCreds?: { key: string; secret: string; pass: string } | null;
  };
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ ok: false, err: "INVALID_JSON" }, { status: 400 });
  }

  const path   = buildOkxPath(req);
  const config = loadServerConfigFromEnv(process.env);
  const isDemo = !!parsed.isDemo;

  // Layer 3: client-supplied body creds (legacy)
  let clientCreds: OkxCredentials | null = parsed.clientCreds?.key
    ? parsed.clientCreds
    : null;

  // Layer 2: Clerk metadata — only when Layer 1 absent and no client creds
  if (!config.okxApiKey && !clientCreds) {
    try {
      const { userId } = await auth();
      if (userId) clientCreds = await loadCredsFromClerk(userId, isDemo);
    } catch {
      // Clerk not configured — ignore
    }
  }

  const result = await handleOkxProxy(
    {
      method: parsed.body !== undefined ? "POST" : "GET",
      path,
      body: parsed.body,
      isDemo,
      clientCreds,
    },
    config,
  );
  return NextResponse.json(result);
}
