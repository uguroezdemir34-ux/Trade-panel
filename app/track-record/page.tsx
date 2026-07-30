/**
 * /track-record — herkese açık, auth gerektirmeyen sinyal sicili sayfası.
 *
 * Server component: /api/track-record'u aynı origin'den fetch eder (DB
 * sorgusunu burada TEKRARLAMAZ — route.ts zaten doğru, ona dokunulmadı).
 * Filtreleme (parite) client tarafında (bkz. TrackRecordView) — API'den
 * tüm veri tek seferde çekilir.
 */

import type { Metadata } from "next";
import { serverEnv } from "@/lib/config/env";
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
    const res = await fetch(`${serverEnv.appUrl}/api/track-record`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as TrackRecordResponse;
  } catch (err) {
    console.error("[/track-record page]", err);
    return null;
  }
}

export default async function TrackRecordPage(): Promise<React.ReactElement> {
  const data = await fetchTrackRecord();
  return <TrackRecordView data={data} />;
}
