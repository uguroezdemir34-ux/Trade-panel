/**
 * GET /api/track-record — herkese açık, salt-okunur, kayıp-dahil filtresiz
 * sinyal performans verisi (ROADMAP.md ADIM 2, madde 1).
 *
 * Gerçek sorgu/hesaplama mantığı lib/track-record/fetchTrackRecordData.ts'e
 * taşındı (bkz. o dosyanın header yorumu — app/track-record/page.tsx artık
 * bu route'a HTTP self-fetch atmıyor, aynı fonksiyonu doğrudan çağırıyor,
 * build-time ECONNREFUSED riski ortadan kalktı). Bu dosya artık sadece
 * HTTP şekillendirme (status kodları, JSON response) yapıyor, davranış
 * (query yok, tüm veri tek seferde) değişmedi.
 */

import { NextResponse } from "next/server";
import { fetchTrackRecordData } from "@/lib/track-record/fetchTrackRecordData";

export const revalidate = 300;

export async function GET(): Promise<NextResponse> {
  try {
    const data = await fetchTrackRecordData();
    if (!data) {
      return NextResponse.json({ error: "Track record not configured" }, { status: 503 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/track-record]", err);
    return NextResponse.json({ error: "Failed to load track record" }, { status: 500 });
  }
}
