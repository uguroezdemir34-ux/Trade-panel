"use client";

import { useEffect } from "react";

export default function KararError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[karar] page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
      <div className="rounded-xl border border-signal-red/30 bg-signal-red/8 px-6 py-5 max-w-md w-full">
        <p className="font-mono text-xs font-bold tracking-widest text-signal-red uppercase mb-2">
          Sayfa Hatası
        </p>
        <p className="font-mono text-sm text-text-t2 mb-4">
          Karar sayfası yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.
        </p>
        {error.message && (
          <p className="font-mono text-2xs text-red-300 mb-2 text-left break-all whitespace-pre-wrap max-h-32 overflow-auto">
            {error.message}
          </p>
        )}
        {error.digest && (
          <p className="font-mono text-2xs text-text-t4 mb-4">
            Kod: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="font-mono text-xs font-bold px-4 py-2 rounded border border-brand text-brand hover:bg-brand/10 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
