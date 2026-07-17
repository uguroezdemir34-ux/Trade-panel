/**
 * WAITLIST ONAY — server-only paylaşılan yardımcı.
 *
 * İki çağıran: app/api/admin/waitlist/approve/route.ts (elle onay) ve
 * app/api/waitlist/register/route.ts (3 referral'a ulaşınca otomatik onay).
 *
 * Onaylanan email'in ARKASINDA henüz bir Clerk hesabı olmayabilir (waitlist
 * kaydı, hesap açmadan önce mümkün — bkz. WaitlistScreen). Bu durumda
 * sadece waitlist.status='approved' yazılır, Clerk tarafı henüz
 * senkronize edilemez — kişi daha sonra hesap açıp bir beta-gated sayfaya
 * geldiğinde middleware.ts'teki fallback kontrolü bunu yakalayıp Clerk
 * metadata'sını o an senkronize eder (self-healing, bkz. middleware.ts).
 */

import { dbSelect, dbUpdate } from "@/lib/db/server";
import { findClerkUserIdByEmail, patchClerkPublicMetadata } from "@/lib/clerk/metadata";

export interface ApproveResult {
  ok: boolean;
  /** Clerk hesabı bulunup betaAccess anında set edildi mi? */
  clerkSynced: boolean;
}

export async function approveWaitlistEmail(email: string): Promise<ApproveResult> {
  const normalized = email.trim().toLowerCase();

  const rows = await dbSelect<{ id: number; email: string }>(
    "waitlist",
    `email=eq.${encodeURIComponent(normalized)}&select=id,email`,
  );
  if (rows.length === 0) return { ok: false, clerkSynced: false };

  await dbUpdate("waitlist", { status: "approved" }, `email=eq.${encodeURIComponent(normalized)}`);

  try {
    const userId = await findClerkUserIdByEmail(normalized);
    if (!userId) return { ok: true, clerkSynced: false };
    await patchClerkPublicMetadata(userId, { betaAccess: true });
    return { ok: true, clerkSynced: true };
  } catch (err) {
    console.error("[approveWaitlistEmail] Clerk senkronizasyonu başarısız (waitlist yine de onaylandı):", err);
    return { ok: true, clerkSynced: false };
  }
}
