/**
 * OI SNAPSHOT CACHE — server-side only (cron).
 *
 * lib/server/signalEngine.ts'teki eski _oiSnapshots (in-memory Map) yerine
 * geçiyor. Neden gerekli: computeOiVelocityWindow() en az 2 snapshot
 * istiyor (lib/market/oi-velocity.ts), ama saatlik cron'un her çalışması
 * muhtemelen yeni bir serverless container'da (cold start) başlıyor —
 * in-memory Map bu durumda hiçbir zaman 1'den fazla snapshot biriktiremez,
 * velocity hep null, oiBonus hep 0 kalır (Phase 1.0 — OI Runtime
 * Verification, chat'te bulundu). Bu modül, macroStore.ts'in browser'da
 * localStorage'a yaptığının sunucu tarafındaki karşılığı: pair başına
 * TEK satırda, snapshot dizisi JSONB olarak Supabase'e yazılıyor.
 *
 * Import only from Next.js route handlers / server modules (never from
 * "use client").
 */

import { dbSelect, dbUpsert, isDbConfigured } from "./server";
import type { OiSnapshot } from "@/lib/market/oi-velocity";

const TABLE = "oi_snapshot_cache";

interface OiSnapshotCacheRow {
  pair: string;
  snapshots: OiSnapshot[];
}

/**
 * Verilen tüm pariteler için mevcut snapshot geçmişini TEK Supabase
 * isteğiyle çeker (score_history'nin batch-upsert desenindeki gerekçe
 * aynen geçerli: cron'un 10sn bütçesini, Hobby plan, gereksiz zorlamamak).
 *
 * Supabase yapılandırılmamışsa veya istek başarısız olursa boş bir harita
 * döner — cron eski (cold-start) davranışına sessizce düşer, hata fırlatmaz.
 */
export async function loadOiSnapshotCache(
  pairs: readonly string[],
): Promise<Map<string, OiSnapshot[]>> {
  const result = new Map<string, OiSnapshot[]>();
  if (pairs.length === 0 || !isDbConfigured()) return result;

  try {
    const pairList = pairs.map((p) => encodeURIComponent(p)).join(",");
    const rows = await dbSelect<OiSnapshotCacheRow>(TABLE, `pair=in.(${pairList})`);
    for (const row of rows) {
      result.set(row.pair, Array.isArray(row.snapshots) ? row.snapshots : []);
    }
  } catch (err) {
    console.error(`[oiSnapshotCache] load failed — cron soğuk-başlangıç gibi devam edecek:`, err);
  }
  return result;
}

/**
 * Güncellenmiş snapshot haritasını TEK batch upsert ile geri yazar.
 * Trimleme (yaş/adet sınırı) çağıran tarafın sorumluluğunda — bu modül
 * ham diziyi olduğu gibi saklar, kendi bir sınırlama uygulamaz.
 *
 * Hata durumunda sessizce loglar, cron'u kesmez (score_history ile aynı
 * "önce ölçüm altyapısı, sonra karar" toleransı — bir cron çalışmasının
 * cache yazımı başarısız olsa bile sinyal/Telegram akışı etkilenmemeli).
 */
export async function saveOiSnapshotCache(
  entries: Map<string, OiSnapshot[]>,
): Promise<void> {
  if (entries.size === 0 || !isDbConfigured()) return;

  const rows: OiSnapshotCacheRow[] = Array.from(entries.entries()).map(([pair, snapshots]) => ({
    pair,
    snapshots,
  }));

  try {
    await dbUpsert(TABLE, rows, "pair");
  } catch (err) {
    console.error(`[oiSnapshotCache] save failed:`, err);
  }
}
