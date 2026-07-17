/**
 * CLERK PUBLIC METADATA — paylaşılan yardımcı, server-only.
 *
 * `/v1/users/{id}` (plain PATCH) DEĞİL, `/v1/users/{id}/metadata` (dedike
 * merge endpoint'i) kullanılıyor — plain PATCH public_metadata'yı TAMAMEN
 * DEĞİŞTİRİR (replace), örn. bir kullanıcı Pro'ya yükseldiğinde betaAccess
 * flag'ini sessizce silerdi (bu session'da gerçek bir bug olarak bulundu
 * ve düzeltildi, bkz. app/api/stripe/webhook/route.ts geçmişi). Bu
 * fonksiyon her zaman merge endpoint'ini kullanır, hem Stripe webhook hem
 * waitlist onay akışı bunu paylaşır.
 */
export async function patchClerkPublicMetadata(
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) throw new Error("CLERK_SECRET_KEY not set");

  const res = await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${clerkKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_metadata: fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Clerk metadata update failed: ${err}`);
  }
}

/**
 * Email'e göre Clerk kullanıcısı arar. Waitlist onayı sırasında kişi henüz
 * hesap açmamış olabilir — bu durumda `null` döner, çağıran taraf bunu
 * "henüz kayıt olmadı, kayıt olunca otomatik senkronize olacak" olarak ele
 * almalı (bkz. middleware.ts'teki waitlist fallback kontrolü).
 */
export async function findClerkUserIdByEmail(email: string): Promise<string | null> {
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) return null;

  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address[]=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${clerkKey}` } },
  );
  if (!res.ok) return null;

  const json = (await res.json()) as unknown;
  // Clerk'in list-users endpoint'i düz dizi de dönebilir, {data:[...]} da —
  // ikisini de tolere ediyoruz.
  const users = Array.isArray(json)
    ? json
    : (json as { data?: unknown[] })?.data ?? [];
  const first = users[0] as { id?: string } | undefined;
  return first?.id ?? null;
}
