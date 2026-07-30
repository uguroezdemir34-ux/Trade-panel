"use client";

/**
 * ADMIN — GENEL BAKIŞ (kullanıcı listesi)
 *
 * app/admin/waitlist/page.tsx'in yapısı referans alındı: aynı auth guard'ı
 * (middleware.ts'teki isAdminPageRoute — bu dosyaya ayrıca bir şey eklemeye
 * gerek yok, "/admin(.*)" zaten kapsıyor), aynı fetch-on-mount + error-state
 * deseni.
 *
 * Veri kaynağı tamamen Clerk (email/kayıt tarihi/son giriş) + Clerk
 * publicMetadata.plan (ödeme durumu) — bkz. app/api/admin/overview/route.ts
 * header yorumu: stripe_events tablosu kasıtlı olarak KULLANILMADI, çünkü
 * o tablo kullanıcı bazlı bir durum tutmuyor (sadece webhook idempotency).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface OverviewRow {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  paymentStatus: "active" | "inactive";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminOverviewPage(): React.ReactElement {
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/overview");
      const data = (await res.json()) as { rows?: OverviewRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Yüklenemedi");
      setRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-bg p-4 text-text-t1">
      <nav className="mb-4 flex gap-4 font-mono text-xs">
        <Link href="/admin/waitlist" className="text-text-t3 hover:text-text-t1">
          Waitlist
        </Link>
        <span className="text-brand">Genel Bakış</span>
      </nav>

      <h1 className="mb-1 font-mono text-lg font-bold tracking-wide">Genel Bakış</h1>
      <p className="mb-4 font-mono text-xs text-text-t3">
        {rows.length} kullanıcı — ödeme durumu Clerk publicMetadata.plan'dan (pro/enterprise
        = aktif) okunuyor.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="font-mono text-xs text-text-t3">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-text-t3">Kullanıcı bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] font-mono text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-card text-left text-text-t3">
                <th className="p-2">Email</th>
                <th className="p-2">Kayıt Tarihi</th>
                <th className="p-2">Son Giriş</th>
                <th className="p-2">Ödeme Durumu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="p-2 text-text-t1">{row.email}</td>
                  <td className="p-2 text-text-t2">{formatDate(row.createdAt)}</td>
                  <td className="p-2 text-text-t2">{formatDate(row.lastSignInAt)}</td>
                  <td className="p-2">
                    <span
                      className={
                        row.paymentStatus === "active" ? "text-signal-up" : "text-text-t3"
                      }
                    >
                      {row.paymentStatus === "active" ? "aktif" : "pasif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
