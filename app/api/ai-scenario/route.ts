/**
 * GET /api/ai-scenario?symbol=BTC
 *
 * En son kaydedilmiş AI Senaryo satırını döner (lib/db/aiScenarios.ts →
 * insertAiScenario'nun /api/cron/ai-scenario'dan yazdığı satırlardan).
 * app/api/go-signals/route.ts ile AYNI desen: isDbConfigured() kontrolü,
 * NextResponse.json ile dönüş, no user scope (global veri, auth yok).
 *
 * DOĞRULANMAMIŞ VARSAYIM (CLAUDE.md §0.1 madde 3 — emin olunmayan yer
 * açıkça işaretlendi): score/sr_levels kolonları Postgres'te JSONB.
 * dbSelect<T> generic'i sadece bir TypeScript cast'i, runtime'da hiçbir
 * şema doğrulaması yapmıyor. Aşağıdaki AiScenarioRow'daki
 * AIScoreResult/SrLevels tipleri, bu satırı yazan insertAiScenario'nun
 * gerçekten bu şekilleri yazdığı VARSAYIMINA dayanıyor — tip sistemi
 * bunu garanti ETMİYOR, DB'deki gerçek veri (örn. eski/farklı bir cron
 * sürümünden kalma) şema dışı olabilir.
 */

import { NextRequest, NextResponse } from "next/server";
import { dbSelect, isDbConfigured } from "@/lib/db/server";
import type { AIScoreResult } from "@/lib/analysis/score";
import type { SrLevels } from "@/lib/sr/detect";

export interface AiScenarioRow {
  id: string;
  symbol: string;
  timeframe: string;
  current_price: number;
  score: AIScoreResult;
  sr_levels: SrLevels;
  chart_image_url: string | null;
  created_at: string;
}

// app/api/cron/ai-scenario/route.ts'teki SCENARIO_SYMBOLS ile AYNI 3 sembol
// — export edilmediği için yerel kopya (repodaki emsal: isCronAuthorized de
// her cron route'ta kendi kopyasını tutuyor, paylaşılan bir sabite hiç
// çıkarılmamış).
const VALID_SYMBOLS = ["BTC", "ETH", "SOL"] as const;
type ValidSymbol = (typeof VALID_SYMBOLS)[number];

function isValidSymbol(value: string | null): value is ValidSymbol {
  return value !== null && (VALID_SYMBOLS as readonly string[]).includes(value);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!isValidSymbol(symbol)) {
    return NextResponse.json({ ok: false, error: "invalid_symbol" }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, data: null });
  }

  try {
    const rows = await dbSelect<AiScenarioRow>(
      "ai_scenarios",
      `symbol=eq.${symbol}&order=created_at.desc&limit=1`,
    );
    return NextResponse.json({ ok: true, data: rows[0] ?? null });
  } catch (err) {
    console.error("[/api/ai-scenario GET]", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}
