/**
 * AUTH SCOPE — Manages the current user ID for localStorage key scoping.
 *
 * All store data is isolated per user: ug52_{userId}_{key}
 * Set by AppShell after Clerk auth loads, before store rehydration.
 */

let _currentUserId = "guest";

export function setCurrentUserId(userId: string): void {
  _currentUserId = userId || "guest";
}

export function getCurrentUserId(): string {
  return _currentUserId;
}

/** Storage prefix scoped to the current user */
export function getUserStoragePrefix(): string {
  return `ug52_${_currentUserId}_`;
}
