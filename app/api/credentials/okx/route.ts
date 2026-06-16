/**
 * /api/credentials/okx — Server-side OKX credential storage via Clerk privateMetadata.
 *
 * Security guarantees:
 *   - Encrypted at rest with EXCHANGE_CREDS_KEY (AES-256-GCM, separate from STATE_ENCRYPTION_KEY)
 *   - Plaintext credentials are NEVER returned to the client or logged
 *   - GET returns only { okxProd: boolean, okxDemo: boolean } status flags
 *   - Requires authenticated Clerk session (401 if not logged in)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { clerkClient } from "@clerk/nextjs/server";
import { encryptCreds } from "@/lib/server/encryptCreds";
import { z } from "zod";

const saveSchema = z.object({
  key:    z.string().min(1),
  secret: z.string().min(1),
  pass:   z.string().min(1),
  isDemo: z.boolean(),
});

/** GET — returns configured status only, never actual keys */
export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ okxProd: false, okxDemo: false });
  }

  try {
    const client = await clerkClient();
    const user   = await client.users.getUser(userId);
    const meta   = (user.privateMetadata ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      okxProd: typeof meta.okxProd === "string" && meta.okxProd.length > 0,
      okxDemo: typeof meta.okxDemo === "string" && meta.okxDemo.length > 0,
    });
  } catch {
    return NextResponse.json({ okxProd: false, okxDemo: false });
  }
}

/** POST — encrypt credentials and save to Clerk privateMetadata */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, err: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, err: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, err: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const { isDemo, ...creds } = parsed.data;

  let encrypted: string;
  try {
    encrypted = encryptCreds(JSON.stringify(creds));
  } catch (e) {
    // EXCHANGE_CREDS_KEY not configured in env
    console.error("[credentials/okx] encrypt failed:", (e as Error).message);
    return NextResponse.json({ ok: false, err: "KEY_NOT_CONFIGURED" }, { status: 503 });
  }

  const metaKey = isDemo ? "okxDemo" : "okxProd";
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { [metaKey]: encrypted },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[credentials/okx] clerk update failed:", (e as Error).message);
    return NextResponse.json({ ok: false, err: "CLERK_ERROR" }, { status: 500 });
  }
}

/** DELETE — clear credentials from Clerk privateMetadata */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, err: "UNAUTHORIZED" }, { status: 401 });
  }

  const mode   = new URL(req.url).searchParams.get("mode");
  const metaKey = mode === "demo" ? "okxDemo" : "okxProd";

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { [metaKey]: null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[credentials/okx] clerk delete failed:", (e as Error).message);
    return NextResponse.json({ ok: false, err: "CLERK_ERROR" }, { status: 500 });
  }
}
