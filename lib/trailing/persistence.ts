/**
 * STORAGE ABSTRACTION — `lib/risk/discipline-log.ts` ve `lib/risk/
 * btc-cooldown.ts` tarafından paylaşılan `StorageLike` tipi.
 *
 * Önceden bu dosya trail (otomatik trailing stop) persistence mantığını da
 * içeriyordu (saveTrails/loadTrails/trailKey/migrateOldTrailKey) — otomatik
 * trailing yönetimi kalıcı olarak kaldırıldığında (bkz. ROADMAP.md Adım 3)
 * onlarla birlikte silindi. Bu dosya `lib/trailing/` altında kalmaya devam
 * ediyor çünkü iki risk modülü zaten buradan import ediyor — taşımak
 * gereksiz bir risk, sadece isim tarihseldir.
 */

/**
 * localStorage abstraction — Storage Web API'siyle uyumlu minimal set.
 * Browser'da: `window.localStorage` geçilir.
 * Test/Node: bellek tabanlı mock geçilir.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
