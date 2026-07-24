/**
 * GET /api/scan/universe — lib/scan/universe.ts'in doğrulama endpoint'i.
 * Sadece manuel test amaçlı, UI'a bağlı değil.
 *
 * ?pairs=1 — GEÇİCİ DEBUG parametresi (VPIN vol24h ölçek doğrulaması için,
 * chat'te istendi): SADECE mevcut 9 skorlanan parite döner (9 satır,
 * telefonda tek ekranda okunur) — normal davranışın tam tersi (normalde
 * bu 9'u hariç tutar). Doğrulama bitince kaldırılabilir.
 */

import { NextRequest, NextResponse } from "next/server";
import { scanUniverse } from "@/lib/scan/universe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const onlyExisting = req.nextUrl.searchParams.get("pairs") === "1";
  try {
    const candidates = await scanUniverse({ onlyExisting });
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[/api/scan/universe]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 502 },
    );
  }
}
