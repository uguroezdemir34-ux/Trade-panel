"use client";

/**
 * ADMIN — WAITLIST ONAY EKRANI
 *
 * middleware.ts zaten /admin(.*) route'unu ADMIN_USER_IDS'e göre koruyor
 * (bkz. lib/auth/admin.ts) — burası sadece o korumanın arkasındaki UI.
 * Yetkisiz biri buraya HİÇ ulaşamaz (Edge seviyesinde /karar'a redirect
 * edilir), ama /api/admin/waitlist* route'ları da kendi 403'lerini ayrıca
 * döndürüyor (ikinci savunma katmanı) — bu sayfa 403 durumunda da makul
 * bir hata mesajı gösterir.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface WaitlistRow {
  id: number;
  email: string;
  referral_code: string;
  referred_by: string | null;
  status: string;
  created_at: string;
}

export default function AdminWaitlistPage(): React.ReactElement {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/waitlist");
      const data = (await res.json()) as { rows?: WaitlistRow[]; error?: string };
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

  async function handleApprove(email: string): Promise<void> {
    setApproving(email);
    try {
      const res = await fetch("/api/admin/waitlist/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; clerkSynced?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Onay başarısız");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onay başarısız");
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="min-h-screen bg-bg p-4 text-text-t1">
      <nav className="mb-4 flex gap-4 font-mono text-xs">
        <span className="text-brand">Waitlist</span>
        <Link href="/admin/genel-bakis" className="text-text-t3 hover:text-text-t1">
          Genel Bakış
        </Link>
      </nav>

      <h1 className="mb-1 font-mono text-lg font-bold tracking-wide">Waitlist Onay</h1>
      <p className="mb-4 font-mono text-xs text-text-t3">
        {rows.length} kayıt — onaylanan kullanıcı, hesabı zaten varsa anında beta erişimi alır;
        yoksa hesap açtığında otomatik senkronize olur.
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/5 px-4 py-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="font-mono text-xs text-text-t3">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="font-mono text-xs text-text-t3">Waitlist boş.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] font-mono text-xs">
            <thead>
              <tr className="border-b border-border bg-bg-card text-left text-text-t3">
                <th className="p-2">#</th>
                <th className="p-2">Email</th>
                <th className="p-2">Kod</th>
                <th className="p-2">Davet Eden</th>
                <th className="p-2">Durum</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="p-2 text-text-t3">{row.id}</td>
                  <td className="p-2 text-text-t1">{row.email}</td>
                  <td className="p-2 text-text-t2">{row.referral_code}</td>
                  <td className="p-2 text-text-t3">{row.referred_by ?? "—"}</td>
                  <td className="p-2">
                    <span
                      className={
                        row.status === "approved" ? "text-signal-up" : "text-amber-400"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="p-2">
                    {row.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => void handleApprove(row.email)}
                        disabled={approving === row.email}
                        className="rounded bg-brand px-2 py-1 text-2xs font-bold text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
                      >
                        {approving === row.email ? "…" : "Onayla"}
                      </button>
                    )}
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
