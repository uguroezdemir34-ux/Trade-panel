"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/context";

export function KeyboardShortcutsModal({
  onClose,
}: {
  onClose: () => void;
}): React.ReactElement {
  const t = useT();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") {
        // stopPropagation prevents the parent page's "?" handler from
        // toggling showShortcuts back to true immediately after we close.
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("karar.shortcutsTitle")}
        className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <span className="font-mono text-sm font-bold text-text-t1 tracking-wider">
            {t("karar.shortcutsTitle")}
          </span>
          <button
            onClick={onClose}
            className="font-mono text-xs text-text-t4 transition-colors hover:text-text-t1"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <ul className="divide-y divide-border/20 px-4 py-1">
          {[
            { key: "1 – 9", desc: t("karar.shortcutSelectPair") },
            { key: "[ / ]", desc: t("karar.shortcutPrevNext") },
            { key: "G", desc: t("karar.shortcutNextGo") },
            { key: "?", desc: t("karar.shortcutToggleHelp") },
            { key: "ESC", desc: t("karar.shortcutCloseModal") },
          ].map(({ key, desc }) => (
            <li key={key} className="flex items-center gap-3 py-2.5">
              <kbd className="min-w-[56px] rounded border border-border bg-surface px-2 py-0.5 text-center font-mono text-2xs text-text-t2">
                {key}
              </kbd>
              <span className="flex-1 font-mono text-2xs text-text-t3">{desc}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-border/30 px-4 py-2 text-center">
          <p className="font-mono text-2xs text-text-t4">{t("karar.shortcutsCloseHint")}</p>
        </div>
      </div>
    </>
  );
}
