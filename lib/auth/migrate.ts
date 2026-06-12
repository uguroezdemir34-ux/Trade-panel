/**
 * STORAGE MIGRATION — ug52_guest_* → ug52_{userId}_*
 *
 * Runs once per user on first login.
 * Copies guest-scoped keys to user-scoped keys, stripping the "guest_" prefix.
 * Marks completion with a sentinel key to prevent re-running.
 *
 * v2: fixes a bug in v1 where "guest_" was not stripped from the suffix,
 * causing copies to land at ug52_{userId}_guest_KEYNAME instead of
 * ug52_{userId}_KEYNAME. v2 corrects the destination and removes those
 * misplaced v1 artifacts.
 */

import { STORAGE_PREFIX } from "@/lib/store/persist";

const MIGRATION_SENTINEL = "auth_migrated_v2";

function legacyKey(key: string): string {
  return STORAGE_PREFIX + key;
}

function userKey(userId: string, key: string): string {
  return `${STORAGE_PREFIX}${userId}_${key}`;
}

function sentinelKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}_${MIGRATION_SENTINEL}`;
}

/**
 * Migrates guest-scoped ug52_guest_* keys to user-scoped ug52_{userId}_* keys.
 * Safe to call multiple times — sentinel prevents double-migration.
 *
 * @returns number of keys copied (0 if already done or nothing to migrate)
 */
export function migrateStorageForUser(userId: string): number {
  if (typeof window === "undefined") return 0;

  const sentinel = sentinelKey(userId);

  // Already migrated for this user (v2)
  if (window.localStorage.getItem(sentinel) === "1") return 0;

  // --- Step 1: Copy guest-scoped keys to correct user-scoped keys ---
  //
  // Source keys: ug52_guest_KEYNAME  (written while no user was signed in)
  // Correct dst: ug52_{userId}_KEYNAME  (strip the "guest_" segment)
  //
  // We collect suffixes (everything after "ug52_") and skip anything that
  // already starts with "user_" — those are already correctly scoped.

  const legacySuffixes: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith(STORAGE_PREFIX)) continue;
    const suffix = k.slice(STORAGE_PREFIX.length);
    if (suffix.startsWith("user_")) continue; // already scoped — skip
    if (suffix.includes("_auth_migrated_v")) continue; // sentinel key — skip
    legacySuffixes.push(suffix);
  }

  let copied = 0;
  for (const suffix of legacySuffixes) {
    // Strip the "guest_" prefix so the key lands at the correct destination.
    // suffix = "guest_quantix_bt_v1"  →  strippedSuffix = "quantix_bt_v1"
    // suffix = "theme"                →  strippedSuffix = "theme"  (no-op, kept for safety)
    const strippedSuffix = suffix.startsWith("guest_") ? suffix.slice(6) : suffix;

    const src = legacyKey(suffix);               // ug52_guest_KEYNAME  — read only, never deleted
    const dst = userKey(userId, strippedSuffix); // ug52_{userId}_KEYNAME

    // Only copy if destination doesn't already exist (don't overwrite newer data)
    if (window.localStorage.getItem(dst) === null) {
      const val = window.localStorage.getItem(src);
      if (val !== null) {
        window.localStorage.setItem(dst, val);
        copied++;
      }
    }
  }

  // --- Step 2: Remove v1 bug artifacts ---
  //
  // v1 migration copied ug52_guest_KEYNAME → ug52_{userId}_guest_KEYNAME (wrong).
  // Identify and delete every key matching the literal prefix "ug52_" + userId + "_guest_".
  // This pattern can never match the original sources (ug52_guest_*) because userId sits
  // between "ug52_" and "guest_" — no userId means no match.
  //
  // Snapshot keys first (iterating while deleting is undefined behaviour).
  const v1ArtifactPrefix = `${STORAGE_PREFIX}${userId}_guest_`;
  const v1Artifacts: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(v1ArtifactPrefix)) {
      v1Artifacts.push(k);
    }
  }
  for (const k of v1Artifacts) {
    window.localStorage.removeItem(k); // ug52_{userId}_guest_KEYNAME — v1 artifact only
  }

  // Mark v2 migration complete for this user
  window.localStorage.setItem(sentinel, "1");
  return copied;
}
