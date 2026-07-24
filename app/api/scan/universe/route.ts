/**
 * GET /api/scan/universe — lib/scan/universe.ts'in doğrulama endpoint'i.
 * Sadece manuel test amaçlı, UI'a bağlı değil.
 */

import { NextResponse } from "next/server";
import { scanUniverse } from "@/lib/scan/universe";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const candidates = await scanUniverse();
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[/api/scan/universe]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 502 },
    );
  }
}
