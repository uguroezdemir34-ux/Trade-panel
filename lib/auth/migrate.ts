/**
 * STORAGE MIGRATION — ug52_ → ug52_{userId}_
 *
 * Runs once per user on first login.
 * Copies all existing ug52_ keys to user-scoped ug52_{userId}_ keys.
 * Marks completion with a sentinel key to prevent re-running.
 */

import { STORAGE_PREFIX } from "@/lib/store/persist";

const MIGRATION_SENTINEL = "auth_migrated_v1";

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
 * Migrates legacy ug52_* keys to ug52_{userId}_* for the given user.
 * Safe to call multiple times — sentinel prevents double-migration.
 *
 * @returns number of keys migrated (0 if already done or nothing to migrate)
 */
export function migrateStorageForUser(userId: string): number {
  if (typeof window === "undefined") return 0;

  const sentinel = sentinelKey(userId);

  // Already migrated for this user
  if (window.localStorage.getItem(sentinel) === "1") return 0;

  // Collect all legacy keys (ug52_ prefix, no userId segment)
  const legacyKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    if (!k.startsWith(STORAGE_PREFIX)) continue;
    const suffix = k.slice(STORAGE_PREFIX.length);
    // Skip keys that already have a user segment (e.g. ug52_user123_xxx)
    // A user segment would look like: userId portion before first underscore
    // Legacy keys have no underscore-delimited userId — they start directly with the setting name
    // We identify legacy keys as: prefix + key where key doesn't contain a known userId prefix
    // Simple heuristic: if the suffix doesn't contain "_" preceded by a user-like token, it's legacy.
    // More reliable: legacy keys do NOT contain "_" after a 26-char Clerk user ID (user_xxxxx format).
    // Clerk user IDs start with "user_". So any key starting with ug52_user_ is already scoped.
    if (suffix.startsWith("user_")) continue; // already scoped
    // Also skip the sentinel for other users
    if (suffix.includes("_auth_migrated_v1")) continue;
    legacyKeys.push(suffix);
  }

  if (legacyKeys.length === 0) {
    // Nothing to migrate — mark as done anyway
    window.localStorage.setItem(sentinel, "1");
    return 0;
  }

  let copied = 0;
  for (const key of legacyKeys) {
    const src = legacyKey(key);
    const dst = userKey(userId, key);
    // Only copy if destination doesn't already exist (don't overwrite newer data)
    if (window.localStorage.getItem(dst) === null) {
      const val = window.localStorage.getItem(src);
      if (val !== null) {
        window.localStorage.setItem(dst, val);
        copied++;
      }
    }
  }

  // Mark migration complete for this user
  window.localStorage.setItem(sentinel, "1");
  return copied;
}
