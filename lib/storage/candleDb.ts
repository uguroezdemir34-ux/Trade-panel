/**
 * CANDLE DB — IndexedDB wrapper for historical backtest data.
 *
 * localStorage max ~5-10 MB — insufficient for 38MB of backtest candles.
 * IndexedDB allows 50%+ of available disk space (typically 500MB+).
 *
 * Schema:
 *   DB: "quantix_bt_v1"
 *   Store: "hist_candles"
 *   Key: "${pair}_${tf}" (e.g. "BTC_1h")
 *   Value: { key, candles, fetchedAt }
 */

import type { Pair } from "@/lib/constants/pairs";
import type { Candle, Timeframe } from "@/lib/okx/candles";

const DB_NAME = "quantix_bt_v1";
const DB_VERSION = 1;
const STORE = "hist_candles";

interface DbEntry {
  key: string;
  candles: Candle[];
  fetchedAt: number;
}

function dbKey(pair: Pair, tf: Timeframe): string {
  return `${pair}_${tf}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCandlesFromDb(
  pair: Pair,
  tf: Timeframe,
): Promise<{ candles: Candle[]; fetchedAt: number } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(dbKey(pair, tf));
    req.onsuccess = () => {
      const entry = req.result as DbEntry | undefined;
      db.close();
      resolve(entry ? { candles: entry.candles, fetchedAt: entry.fetchedAt } : null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function saveCandlesToDb(
  pair: Pair,
  tf: Timeframe,
  candles: Candle[],
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const entry: DbEntry = { key: dbKey(pair, tf), candles, fetchedAt: Date.now() };
    const req = tx.objectStore(STORE).put(entry);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function clearHistoricalDb(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Returns a summary of what's stored (for the UI info panel). */
export async function getDbCoverage(): Promise<
  Array<{ pair: string; tf: string; count: number; fetchedAt: number }>
> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as DbEntry[]).map((e) => ({
        pair: e.key.split("_")[0],
        tf: e.key.split("_")[1],
        count: e.candles.length,
        fetchedAt: e.fetchedAt,
      }));
      db.close();
      resolve(rows);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
