/**
 * MANUEL AI ANALİZ — /karar ve /grafik'teki "AI Analiz" butonu için.
 * Skor motorunun o an önerdiği yönü (LONG/SHORT) alır, GO sinyali akışında
 * ZATEN kullanılan checkHumanTraderApprovalAtFireTime() + narrateHumanTraderCheck()
 * + renderSignalChart()/exportSignalChartPngServer() altyapısını çalıştırıp
 * sonucu JSON olarak döner (PNG base64 + anlatım metni + sayısal detaylar).
 *
 * YENİ BİR PUANLAMA SİSTEMİ YOK — score body'den (client'ın ZATEN elinde
 * tuttuğu scoreStore sonucundan) geliyor, burada asla yeniden hesaplanmıyor
 * (bkz. narrateHumanTraderCheck()'in kendi ctx.score kullanım deseni,
 * useSignalFirehose.ts/useGoAlerts.ts ile AYNI: "tek doğru kaynak skor
 * motoru"). lib/score/*'a bu dosyada HİÇ dokunulmadı/import edilmedi.
 *
 * VIP/PUBLIC AYRIMI YOK (Telegram akışının aksine) — bu, kullanıcının KENDİ
 * hesabı için manuel talep ettiği bir analiz, tradeLevels (Entry/Stop/TP1/
 * TP2) HER ZAMAN dolduruluyor.
 *
 * Raw OKX mum çekimi — lib/analysis/ai-scenario.ts / lib/server/signalEngine.ts
 * ile AYNI desenin (fetchOkxCandles, public endpoint, no-store) BİLEREK
 * 4. bir private kopyası: checkHumanTraderApprovalAtFireTime() OKX-şekilli
 * (Candle: open/high/low/close/volume/confirm) ham mum istiyor,
 * fetchScenarioData()'nın çıktısı ise zaten @/types/candle şekline
 * ÇEVRİLMİŞ (o, h, l, c, v) — bu iki şekil birbirinin yerine geçmez, o
 * yüzden burada ayrıca ham veri çekiliyor (mevcut kanıtlanmış koda
 * dokunmama tercihi, küçük bir tekrara karşı — lib/okx/candles.ts'teki
 * fetchCandlesWithStatus'un kendi dosya başı yorumundaki gerekçeyle aynı).
 *
 * SrLevels — renderSignalChart() SADECE nearest_resistance/nearest_support
 * okuyor (resistances/supports dizilerini hiç kullanmıyor, doğrulandı) —
 * bu yüzden detectSRLevels() burada TEKRAR çalıştırılmıyor, humanCheck.srCheck'ten
 * (checkHumanTraderApprovalAtFireTime zaten hesapladı) minimal bir SrLevels
 * objesi kuruluyor.
 *
 * trendLine — humanCheck.trendLine AYNEN kullanılıyor (candles4h'nin AYNI
 * dizisinden hesaplandı, detectTrendLine() burada TEKRAR çağrılmıyor — idx
 * hizası garantili, bkz. lib/share/signalChartData.ts dosya başı yorumu).
 *
 * Rate limit — app/api/log-human-check/route.ts ile AYNI desen (IP başına
 * sliding window, Map<ip,{windowStart,count}>). Limit DAHA DÜŞÜK tutuldu
 * (log-human-check'in aksine bu route Anthropic çağrısı + canvas PNG
 * render + 2 OKX fetch yapıyor — manuel, kullanıcı tetiklemeli, ucuz değil).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupportedPair, type Pair } from "@/lib/constants/pairs";
import { toIndicatorCandle, type Candle as OkxRawCandle } from "@/lib/okx/candles";
import { checkHumanTraderApprovalAtFireTime } from "@/lib/signal/humanTraderCheck";
import type { SrLevels } from "@/lib/sr/detect";
import { narrateHumanTraderCheck } from "@/lib/ai/narrateHumanTraderCheck";
import { exportSignalChartPngServer } from "@/lib/share/exportSignalChartServer";
import type { SignalChartData } from "@/lib/share/renderSignalChart";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 6;
const hitsByIp = new Map<string, { windowStart: number; count: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const entry = hitsByIp.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hitsByIp.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

const requestSchema = z.object({
  pair: z.string().refine(isSupportedPair, { message: "unsupported_pair" }),
  direction: z.enum(["LONG", "SHORT"]),
  score: z.number().finite(),
});

const OKX_BASE = "https://www.okx.com";

function instIdFor(pair: Pair): string {
  return `${pair}-USDT-SWAP`;
}

/** lib/analysis/ai-scenario.ts'teki fetchOkxCandles() ile AYNI parse mantığı
 *  (bkz. dosya başı yorumu — bilinçli 4. kopya). */
async function fetchOkxCandles(instId: string, bar: string, limit: number): Promise<OkxRawCandle[]> {
  const url = `${OKX_BASE}/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${limit}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { code: string; data?: string[][] };
    if (json.code !== "0" || !Array.isArray(json.data)) return [];
    return json.data
      .map((row) => ({
        ts: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        confirm: row[8] === "1",
      }))
      .sort((a, b) => a.ts - b.ts);
  } catch {
    return [];
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  if (isRateLimited(ip, Date.now())) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const pair = body.pair as Pair;
  const instId = instIdFor(pair);

  const [raw1h, raw4h] = await Promise.all([
    fetchOkxCandles(instId, "1H", 300),
    fetchOkxCandles(instId, "4H", 300),
  ]);

  const candles1h = raw1h.filter((c) => c.confirm);
  const candles4h = raw4h.filter((c) => c.confirm);
  if (candles1h.length === 0 || candles4h.length === 0) {
    return NextResponse.json({ ok: false, error: "insufficient_data" }, { status: 200 });
  }

  const currentPrice = candles1h[candles1h.length - 1].close;

  const humanCheck = checkHumanTraderApprovalAtFireTime(body.direction, currentPrice, candles1h, candles4h);

  // Minimal SrLevels — bkz. dosya başı yorumu (renderer sadece nearest_*'i okur).
  const srLevels: SrLevels = {
    resistances: [],
    supports: [],
    nearest_resistance: humanCheck.srCheck.nearestResistance,
    nearest_support: humanCheck.srCheck.nearestSupport,
  };

  // Her zaman dolu — VIP/public ayrımı yok (kullanıcının kendi hesabı için
  // manuel talebi, bkz. dosya başı yorumu).
  const tradeLevels = {
    entry: currentPrice,
    stopPrice: humanCheck.rrCheck.stopPrice,
    tp1Price: humanCheck.rrCheck.tp1Price,
    tp2Price: humanCheck.rrCheck.tp2Price,
  };

  const narrative = await narrateHumanTraderCheck(
    { pair, direction: body.direction, score: body.score, price: currentPrice },
    humanCheck,
  );

  const chartData: SignalChartData = {
    pair,
    direction: body.direction,
    candles: candles4h.map(toIndicatorCandle),
    currentPrice,
    srLevels,
    trendLine: humanCheck.trendLine,
    score: body.score,
    tradeLevels,
    // Sağ üstteki skor+onay kutusunu tetikler (bkz. renderSignalChart.ts'in
    // SignalChartData.approved dosya başı yorumu) — gerçek humanCheck.approved,
    // uydurulmuş bir "Opportunity Score"/"BUY" DEĞİL.
    approved: humanCheck.approved,
  };

  let image: string | null = null;
  try {
    const png = await exportSignalChartPngServer(chartData);
    image = `data:image/png;base64,${png.toString("base64")}`;
  } catch (err) {
    // Görsel üretimi best-effort — başarısız olursa metin/sayısal veri
    // yine de dönülür, tüm istek çöpe gitmez (CLAUDE.md §0.1 madde 3:
    // sessiz varsayım yerine görünür "bilinmiyor" — image:null UI'da
    // görünür bir "görsel üretilemedi" haline geliyor, sessizce yutulmuyor).
    console.error("[signal/analyze] PNG render failed:", err);
  }

  return NextResponse.json({
    ok: true,
    pair,
    direction: body.direction,
    currentPrice,
    image,
    narrative,
    humanCheck,
    tradeLevels,
  });
}
