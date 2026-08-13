/**
 * GET /api/ai-scenario/latest
 *
 * Sembol filtresi YOK — ai_scenarios tablosundaki EN SON satırı (3 sembol
 * arasında, hangisi olursa) döner. Tablo zaten sadece BTC/ETH/SOL satırları
 * içeriyor (app/api/cron/ai-scenario/route.ts → SCENARIO_SYMBOLS), bu
 * yüzden ek bir sembol whitelist kontrolüne gerek yok.
 *
 * ../route.ts (?symbol= zorunlu route) ile AYNI AiScenarioRow tipini
 * kullanıyor — import edildi, ikinci bir kopya açılmadı. Aynı disiplin:
 * boşsa {ok:true, data:null} (henüz veri yok, hata değil), DB hatasında
 * {ok:false, error:"db_error"} 500.
 */

import { NextResponse } from "next/server";
import { dbSelect, isDbConfigured } from "@/lib/db/server";
import type { AiScenarioRow } from "../route";

export async function GET(): Promise<NextResponse> {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, data: null });
  }

  try {
    const rows = await dbSelect<AiScenarioRow>(
      "ai_scenarios",
      "order=created_at.desc&limit=1",
    );
    return NextResponse.json({ ok: true, data: rows[0] ?? null });
  } catch (err) {
    console.error("[/api/ai-scenario/latest GET]", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}
