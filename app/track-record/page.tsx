/**
 * /track-record — herkese açık, auth gerektirmeyen sinyal sicili sayfası.
 *
 * Server component: lib/track-record/fetchTrackRecordData.ts'i DOĞRUDAN
 * çağırır (DB sorgusunu burada TEKRARLAMAZ, /api/track-record ile AYNI
 * paylaşılan fonksiyon). ÖNCEDEN kendi API'sine HTTP self-fetch atıyordu
 * — bu, build-time'da (server henüz dinlemiyorken) ECONNREFUSED riski
 * taşıyordu, try/catch bunu yutup null'a düşürüyordu ama ilk deploy
 * sonrası ISR revalidate'e kadar sayfa kısa süre "yüklenemedi"
 * gösterebiliyordu. Artık ağ round-trip'i hiç yok, bu risk sınıfı
 * tamamen ortadan kalktı. Filtreleme (parite) client tarafında (bkz.
 * TrackRecordView) — tüm veri tek seferde çekilir.
 */

import type { Metadata } from "next";
import { fetchTrackRecordData } from "@/lib/track-record/fetchTrackRecordData";
import { TrackRecordView } from "@/components/track-record/TrackRecordView";
import type { TrackRecordResponse } from "@/lib/track-record/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Track Record — QUANTIX OS",
  description:
    "Public, unfiltered QUANTIX signal performance record — every GO signal and its 15m/1h outcome, wins and losses alike.",
};

async function fetchTrackRecord(): Promise<TrackRecordResponse | null> {
  try {
    return await fetchTrackRecordData();
  } catch (err) {
    console.error("[/track-record page]", err);
    return null;
  }
}

export default async function TrackRecordPage(): Promise<React.ReactElement> {
  const data = await fetchTrackRecord();
  return <TrackRecordView data={data} />;
}
