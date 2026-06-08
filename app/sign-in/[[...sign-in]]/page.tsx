"use client";

import Link from "next/link";

export default function SignInPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="font-mono text-2xl font-bold tracking-widest text-text-t1">
          QUANTIX <span className="text-brand">OS</span>
        </div>
        <p className="text-text-t3 font-mono text-xs tracking-wider mt-1">
          Advanced AI Trading Systems
        </p>
      </div>
      <div className="rounded-lg border border-border bg-bg-card p-8 text-center max-w-sm w-full">
        <p className="font-mono text-sm text-text-t2 mb-4">
          Auth sistemi yapılandırılmamış.
        </p>
        <Link
          href="/"
          className="inline-block rounded bg-brand px-4 py-2 font-mono text-xs text-white tracking-widest hover:bg-brand/90 transition-colors"
        >
          Panele Dön
        </Link>
      </div>
    </div>
  );
}
