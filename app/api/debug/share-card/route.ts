/**
 * GEÇİCİ DOĞRULAMA ROUTE'U — sunucu tarafı kart üretiminin (bkz.
 * lib/share/exportShareCardServer.ts) sabit örnek veriyle gerçekten geçerli
 * bir PNG ürettiğini tarayıcı/telefon karşılaştırmasıyla doğrulamak için.
 * Kalıcı bir ürün özelliği DEĞİL — Telegram/X gönderim entegrasyonu
 * bağlanınca kaldırılacak.
 *
 * Node runtime ZORUNLU — @napi-rs/canvas native binary Edge runtime'da
 * çalışmaz.
 */

import { NextResponse } from "next/server";
import { exportShareCardPngServer } from "@/lib/share/exportShareCardServer";
import type { ShareCardData } from "@/lib/share/renderShareCard";

export const runtime = "nodejs";

const SAMPLE_DATA: ShareCardData = {
  pair: "BTC",
  direction: "LONG",
  verdict: "go",
  confirmStatus: "confirmed",
  score: 78,
  sub: { trend: 18, adx: 9, rsi: 7, vol: 12, bb: 8, vwap: 7, funding: 6, macro: 5 },
  priceLabel: "$64,231.50",
  ts: Date.now(),
  locale: "tr",
  labels: {
    verdict: { go: "GO", wait: "BEKLE", no: "GİRME" },
    direction: { LONG: "LONG", SHORT: "SHORT", NEUTRAL: "NÖTR" },
    confirmPending: "teyit bekleniyor",
    confirmUnknown: "teyit bilinmiyor",
    disclaimer: "Yatırım tavsiyesi değildir.",
    scoreWeightedNote: "rejime göre ağırlıklandırılmış",
    categoriesRawLabel: "HAM KATEGORİ SKORLARI",
    categories: {
      trend: "Trend",
      adx: "ADX",
      rsi: "RSI",
      vol: "Hacim",
      bb: "Bollinger",
      vwap: "VWAP",
      funding: "Funding",
      macro: "Makro",
    },
  },
};

export async function GET(): Promise<NextResponse> {
  try {
    const png = await exportShareCardPngServer(SAMPLE_DATA);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "share-card-server-export-failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
