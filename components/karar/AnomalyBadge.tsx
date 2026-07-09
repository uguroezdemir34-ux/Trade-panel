"use client";

/**
 * ANOMALİ IŞIĞI BADGE — kart köşesindeki ⚠️ ikonu + tap-to-show tooltip.
 *
 * Mobilde hover olmadığı için: dokununca açılır, ~4.5sn sonra kendiliğinden
 * kapanır, başka bir yere dokununca da kapanır. Sadece görsel katman —
 * skor/GO kararına hiç girmez, useScoreEngine/orchestrator'a dokunmaz.
 */

import { useEffect, useRef, useState } from "react";

interface AnomalyBadgeProps {
  oiAnomaly: boolean;
  wallAnomaly: boolean;
}

const AUTO_CLOSE_MS = 4500;

const MSG_OI =
  "Açık pozisyonlarda ani düşüş — büyük oyuncular çıkış yapıyor olabilir. Otomatik bir sinyal değil, sadece dikkatli izlemeni öneririz.";
const MSG_WALL =
  "Sinyal yönünün tersinde güçlü bir emir birikmesi var — fiyat bu yönde zorlanabilir. Otomatik bir sinyal değil, sadece dikkatli izlemeni öneririz.";
const MSG_BOTH =
  "Açık pozisyonlarda ani düşüş VE sinyal yönünün tersinde güçlü bir emir birikmesi var. Otomatik bir sinyal değil, sadece dikkatli izlemeni öneririz.";

export function AnomalyBadge({ oiAnomaly, wallAnomaly }: AnomalyBadgeProps): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dışarı dokununca kapat
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: PointerEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  // Unmount'ta bekleyen timer'ı temizle
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!oiAnomaly && !wallAnomaly) return null;

  const message = oiAnomaly && wallAnomaly ? MSG_BOTH : oiAnomaly ? MSG_OI : MSG_WALL;

  function handleTap(e: React.MouseEvent): void {
    e.stopPropagation();
    setOpen((prev) => !prev);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
  }

  return (
    <span ref={containerRef} className="absolute top-0.5 right-0.5 z-20">
      <span
        role="button"
        tabIndex={0}
        onClick={handleTap}
        className="block text-[10px] leading-none cursor-pointer"
        style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))" }}
        aria-label="Anomali uyarısı"
      >
        ⚠️
      </span>
      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 right-0 w-48 rounded-md border border-white/10 bg-black/90 px-2 py-1.5 text-[10px] leading-snug text-white shadow-lg"
        >
          {message}
        </span>
      )}
    </span>
  );
}
