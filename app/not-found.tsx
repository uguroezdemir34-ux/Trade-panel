"use client";

// Prevent static prerender — this page uses the root layout which contains
// AppHeader → UserButton (@clerk/nextjs), which requires ClerkProvider auth
// context that is only available at request time, not build time.
export const dynamic = "force-dynamic";

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
