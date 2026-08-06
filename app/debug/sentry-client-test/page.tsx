"use client";

/**
 * GEÇİCİ — Sentry client-side doğrulama sayfası (06 Ağu 2026).
 * Server-side zaten doğrulandı (commit b36c95a) — bu sayfa client SDK'nın
 * (instrumentation-client.ts) ayrı kod yolunu doğrulamak için.
 *
 * Butondaki throw BİLEREK bir React event handler'ı İÇİNDE — Error Boundary'ler
 * (app/error.tsx, app/global-error.tsx) event handler hatalarını YAKALAMAZ,
 * bu yüzden hata doğrudan window'un global uncaught-exception mekanizmasına
 * düşer, Sentry'nin varsayılan GlobalHandlers entegrasyonu (instrumentation-client.ts'te
 * ayrıca yapılandırılmaya gerek yok, @sentry/nextjs client SDK'da varsayılan
 * olarak aktif) bunu otomatik yakalar.
 *
 * Doğrulama bitince bu dosya (ve app/debug/ klasörü boşsa tamamı) silinmeli.
 */
export default function SentryClientTestPage() {
  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#fff", background: "#0a0a0a", minHeight: "100vh" }}>
      <p style={{ fontSize: 12, marginBottom: 16 }}>Sentry client-side test — GEÇİCİ, doğrulama sonrası silinecek.</p>
      <button
        onClick={() => {
          throw new Error("Sentry test error — client");
        }}
        style={{ fontFamily: "monospace", fontSize: 12, padding: "8px 16px", border: "1px solid #ef4444", borderRadius: 6, background: "transparent", color: "#ef4444", cursor: "pointer" }}
      >
        Throw Client Error
      </button>
    </div>
  );
}
