/**
 * ADMIN YETKİSİ — server-only. Ayrı bir Clerk role sistemi yok (tek admin —
 * kurucu), o yüzden basit bir env var listesi yeterli: ADMIN_USER_IDS
 * (virgülle ayrılmış Clerk userId'leri, örn. "user_abc,user_def"). Clerk
 * metadata'ya YAZILMIYOR bilerek — env var, client'a hiç sızmaz, Clerk
 * Dashboard'dan yanlışlıkla değiştirilemez.
 */
export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
