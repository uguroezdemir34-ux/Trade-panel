import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { getTradesForUser, upsertTrade, upsertTrades } from "@/lib/db/trades";
import { isDbConfigured } from "@/lib/db/server";
import type { TradeSnapshot } from "@/lib/trades/types";

// ── GET /api/trades ──────────────────────────────────────────────
// Returns all trades for the authenticated user from Supabase.

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ trades: [], configured: false });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const trades = await getTradesForUser(userId);
    return NextResponse.json({ trades, configured: true });
  } catch (err) {
    console.error("[/api/trades GET]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

// ── POST /api/trades ─────────────────────────────────────────────
// Upsert one or many trades for the authenticated user.
// Body: { trade: TradeSnapshot } OR { trades: TradeSnapshot[] }

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, configured: false });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { trade?: TradeSnapshot; trades?: TradeSnapshot[] };
  try {
    body = await req.json() as { trade?: TradeSnapshot; trades?: TradeSnapshot[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.trade) {
      await upsertTrade(userId, body.trade);
    } else if (Array.isArray(body.trades)) {
      await upsertTrades(userId, body.trades);
    } else {
      return NextResponse.json({ error: "Body must contain trade or trades" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/trades POST]", err);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
