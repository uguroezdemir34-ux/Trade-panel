"use client";

/**
 * MODE TOGGLE CARD — Demo Mode toggle'ı.
 *
 * Demo Mode: OKX simulated trading endpoint'i.
 */

import { useT } from "@/lib/i18n/context";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function ModeToggleCard(): React.ReactElement {
  const t = useT();
  const demoMode = useSettingsStore((s) => s.demoMode);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);

  return (
    <div className="border-border bg-bg-card rounded-lg border p-4 space-y-4">
      <h3 className="text-text-t1 font-mono text-sm font-medium">
        {t("settings.title")}
      </h3>

      <ToggleRow
        label={t("settings.demoMode.label")}
        description={t("settings.demoMode.description")}
        value={demoMode}
        onToggle={() => setDemoMode(!demoMode)}
        activeColor="text-signal-amber"
        activeBg="bg-soft-amber"
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
  activeColor,
  activeBg,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  activeColor: string;
  activeBg: string;
}) {
  const t = useT();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-text-t1 font-mono text-xs font-medium">{label}</div>
        <div className="text-text-t3 mt-0.5 font-mono text-2xs leading-relaxed">
          {description}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`shrink-0 rounded border px-2.5 py-1 font-mono text-xs font-bold tracking-widest transition-colors ${
          value
            ? `${activeColor} ${activeBg} border-current`
            : "border-border text-text-t3 bg-transparent"
        }`}
      >
        {value ? t("common.on") : t("common.off")}
      </button>
    </div>
  );
}
