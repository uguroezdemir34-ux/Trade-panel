"use client";

/**
 * ANOMALİ IŞIĞI BADGE — kart köşesindeki ⚠️ ikonu + tap-to-show tooltip.
 *
 * Mobilde hover olmadığı için: dokununca açılır, ~4.5sn sonra kendiliğinden
 * kapanır, başka bir yere dokununca da kapanır. Sadece görsel katman —
 * skor/GO kararına hiç girmez, useScoreEngine/orchestrator'a dokunmaz.
 *
 * "Balina İzleri" genişletmesi: wallDetail geçilirse (wallSizeUsd +
 * wallDistancePct dolu) duvar mesajı somut rakamlarla zenginleşir — yoksa
 * (null/eksik) genel mesaja sessizce düşer, geriye dönük uyumlu.
 *
 * Tooltip yönü: varsayılan olarak sağa (right-0, sola doğru açılır) — ama
 * 3-kolonlu grid'in sol sütunundaki kartlarda (örn. BTC) bu, viewport'un
 * sol kenarından taşırıyordu. columnIndex prop'u geçirmek page.tsx'e de
 * dokunmayı gerektirirdi; bunun yerine açılmadan hemen önce badge'in
 * viewport'taki konumu ölçülüp yeterli yer yoksa left-0'a (sağa doğru
 * açılır) geçiliyor — sıfır yeni prop, sadece bu dosya içinde kalıyor.
 * useLayoutEffect kullanıldı (useEffect değil) ki yön düzeltmesi boyanmadan
 * önce uygulansın, yanlış konumda bir kare flicker olmasın.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { OrderBookImbalanceResult } from "@/lib/market/orderbook-imbalance";

const TOOLTIP_WIDTH_PX = 192; // w-48
const VIEWPORT_SAFETY_MARGIN_PX = 8;

interface AnomalyBadgeProps {
  oiAnomaly: boolean;
  wallAnomaly: boolean;
  /** Duvar mesajını zenginleştirmek için — opsiyonel, yoksa genel mesaj kullanılır */
  wallDetail?: OrderBookImbalanceResult | null;
}

const AUTO_CLOSE_MS = 4500;

const OI_CLAUSE = "açık pozisyonlarda ani düşüş — büyük oyuncular çıkış yapıyor olabilir";
const OI_CLAUSE_SHORT = "açık pozisyonlarda ani düşüş";
const MSG_SUFFIX = " Otomatik bir sinyal değil, sadece dikkatli izlemeni öneririz.";

function formatWallSize(usd: number): string {
  return usd >= 1_000_000 ? `$${(usd / 1_000_000).toFixed(1)}M` : `$${(usd / 1_000).toFixed(0)}K`;
}

/** Duvar detayı doluysa somut rakamlı, yoksa genel duvar cümleciği (küçük harfle başlar, birleştirilebilir). */
function buildWallClause(detail: OrderBookImbalanceResult | null | undefined): string {
  if (detail?.wallSizeUsd != null && detail?.wallDistancePct != null) {
    return `sinyal yönünün tersinde ${formatWallSize(detail.wallSizeUsd)} büyüklüğünde bir emir duvarı var, fiyatın %${detail.wallDistancePct.toFixed(1)} uzağında`;
  }
  return "sinyal yönünün tersinde güçlü bir emir birikmesi var";
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
}

export function AnomalyBadge({
  oiAnomaly,
  wallAnomaly,
  wallDetail,
}: AnomalyBadgeProps): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<"left" | "right">("right");
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Açılmadan hemen önce viewport'a göre yön seç — sola yeterli yer yoksa
  // (sol sütun kartları) left-0'a (sağa açılan) geç, aksi halde varsayılan
  // right-0 (sola açılan) kalsın.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipAnchor(
      rect.right - TOOLTIP_WIDTH_PX - VIEWPORT_SAFETY_MARGIN_PX < 0 ? "left" : "right",
    );
  }, [open]);

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

  let message: string;
  if (oiAnomaly && wallAnomaly) {
    // Kısa çekirdek cümlecikler — iki dolgulu açıklama üst üste binmesin diye
    message = `${capitalize(OI_CLAUSE_SHORT)} VE ${buildWallClause(wallDetail)}.${MSG_SUFFIX}`;
  } else if (oiAnomaly) {
    message = `${capitalize(OI_CLAUSE)}.${MSG_SUFFIX}`;
  } else {
    message = `${capitalize(buildWallClause(wallDetail))} — fiyat bu yönde zorlanabilir.${MSG_SUFFIX}`;
  }

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
          className={[
            "absolute top-4 w-48 max-w-[calc(100vw-2rem)] rounded-md border border-white/10 bg-black/90 px-2 py-1.5 text-[10px] leading-snug text-white shadow-lg",
            tooltipAnchor === "left" ? "left-0" : "right-0",
          ].join(" ")}
        >
          {message}
        </span>
      )}
    </span>
  );
}
