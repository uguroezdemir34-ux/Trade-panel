"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] root layout error:", error);
  }, [error]);

  return (
    <html>
      <body style={{ background: "#0a0a0a", color: "#fff", fontFamily: "monospace", padding: "24px" }}>
        <div style={{ maxWidth: "480px", margin: "0 auto", paddingTop: "60px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#ef4444", textTransform: "uppercase", marginBottom: "8px" }}>
            Global Hata
          </p>
          {error.message && (
            <pre style={{ fontSize: "11px", color: "#fca5a5", background: "#1c0000", padding: "12px", borderRadius: "6px", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "200px", overflow: "auto", marginBottom: "12px" }}>
              {error.message}
            </pre>
          )}
          {error.stack && (
            <pre style={{ fontSize: "10px", color: "#6b7280", background: "#111", padding: "12px", borderRadius: "6px", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: "200px", overflow: "auto", marginBottom: "16px" }}>
              {error.stack}
            </pre>
          )}
          {error.digest && (
            <p style={{ fontSize: "10px", color: "#4b5563", marginBottom: "16px" }}>
              digest: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ fontFamily: "monospace", fontSize: "12px", padding: "8px 16px", border: "1px solid #c35523", borderRadius: "6px", background: "transparent", color: "#c35523", cursor: "pointer" }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
