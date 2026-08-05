"use client";

// force-dynamic KALDIRILDI (bkz. components/layout/RouteAwareShell.tsx):
// bu sayfa root layout'u kullanıyordu ve layout AppHeader → UserButton
// (@clerk/nextjs) içeriyordu — ama UserButton sadece AppShell mount
// edildiğinde render ediliyor, RouteAwareShell artık 404'te (bilinen hiçbir
// public/app route'una denk gelmeyen pathname) AppShell'i hiç mount
// etmiyor. Yani bu sayfa artık request-time Clerk auth context'e bağımlı
// değil, statik üretilebilir. CI'da (bundle-analyze.yml, workflow_dispatch)
// gerçek `next build` ile doğrulandı.
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono">
      <span className="text-4xl font-bold text-text-t1">404</span>
      <span className="text-text-t3 text-sm tracking-widest uppercase">Sayfa Bulunamadı</span>
      <Link
        href="/"
        className="mt-2 px-4 py-2 rounded border border-border text-text-t2 text-xs hover:border-brand hover:text-brand transition-colors"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
