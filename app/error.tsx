"use client";

import { useEffect } from "react";

const SS_KEY = "qx_chunk_reloaded";

function isChunkError(err: Error): boolean {
  return (
    err.name === "ChunkLoadError" ||
    err.message.includes("Loading chunk") ||
    err.message.includes("Failed to fetch dynamically imported module")
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkError(error) && !sessionStorage.getItem(SS_KEY)) {
      sessionStorage.setItem(SS_KEY, "1");
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
      <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-6 py-5 max-w-md w-full">
        <p className="font-mono text-xs font-bold tracking-widest text-red-400 uppercase mb-2">
          Uygulama Hatası
        </p>
        <p className="font-mono text-sm text-gray-300 mb-4">
          Sayfa yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-gray-500 mb-4">
            Kod: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="font-mono text-xs font-bold px-4 py-2 rounded border border-orange-500 text-orange-400 hover:bg-orange-500/10 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
