/**
 * /api/go-signals — GET
 *
 * Position-adoption akışı (usePositionPoller.ts) için: bir pair'de belirli
 * bir zamandan bu yana kaydedilmiş GO sinyallerini (her iki yön de dahil,
 * filtrelenmemiş) döndürür. No user scope — go_signals global market
 * verisi, auth gerekmiyor (bkz. lib/db/goSignals.ts).
 *
 * Query: ?pair=BTC&sinceMs=1700000000000
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecentGoSignals } from "@/lib/db/goSignals";
import { isDbConfigured } from "@/lib/db/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get("pair");
  const sinceMsRaw = searchParams.get("sinceMs");

  if (!pair || !sinceMsRaw) {
    return NextResponse.json(
      { error: "pair and sinceMs query params are required" },
      { status: 400 },
    );
  }

  const sinceMs = Number(sinceMsRaw);
  if (!Number.isFinite(sinceMs)) {
    return NextResponse.json({ error: "sinceMs must be a number" }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ candidates: [], configured: false });
  }

  try {
    const candidates = await getRecentGoSignals(pair, sinceMs);
    return NextResponse.json({ candidates, configured: true });
  } catch (err) {
    console.error("[/api/go-signals GET]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
