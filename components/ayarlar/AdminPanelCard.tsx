"use client";

/**
 * ADMIN PANEL CARD — Ayarlar sayfasında SADECE admin'e (Uğur) görünen
 * "Yönetici Paneli" satırı, /admin/waitlist'e yönlendirir.
 *
 * Admin kontrolü middleware.ts/lib/auth/admin.ts ile AYNI mekanizma
 * (ADMIN_USER_IDS env var, isAdminUserId()) — ama o env var server-only
 * (bilerek client'a hiç sızmıyor, bkz. lib/auth/admin.ts yorumu), o yüzden
 * bu client component /api/admin/whoami'ye bir round-trip atıp sonucu
 * (sadece boolean) öğreniyor. Yüklenene kadar VEYA admin değilse hiçbir
 * şey render etmiyor — AuthStatusCard.tsx'teki "gitmeyeceği bir yere buton
 * koymamak" felsefesiyle aynı, normal kullanıcı bu satırın var olduğunu
 * hiç fark etmez (flash-of-then-hidden yok, direkt null'dan başlıyor).
 *
 * BİLEREK useT() KULLANMIYOR, Türkçe hardcoded: bu sayfanın (ayarlar)
 * genel deseni i18n'li olsa da, buradan yönlendirilen /admin/waitlist ve
 * /admin/genel-bakis sayfalarının kendisi zaten tamamen Türkçe hardcoded
 * (tek admin — kurucu — Türkçe okuyor, 7 dile çevirmenin bir değeri yok) —
 * bu satır o admin-only bölgenin bir parçası, ayarlar sayfasının genel
 * kullanıcıya dönük i18n kapsamının değil.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export function AdminPanelCard(): React.ReactElement | null {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/whoami")
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => {
        if (!cancelled) setIsAdmin(data.isAdmin === true);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin/waitlist"
      className="border-border bg-bg-card flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:border-brand/40"
    >
      <p className="text-text-t1 font-mono text-xs tracking-wider">Yönetici Paneli</p>
      <span className="text-text-t3 font-mono text-xs">→</span>
    </Link>
  );
}
