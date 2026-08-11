"use client";

/**
 * BRAND HEADER — AppHeader içinde marka kimliği bloğu.
 *
 * Yapı (mobile-first, v3):
 *   QUANTIX OS v3
 *   Flow Intelligence
 *
 * Sadece metin — logo görseli buradan kaldırıldı (kullanıcı kararı,
 * header'da quantix-logo.png ile favicon'un (public/icon.svg) görsel
 * olarak tutarsız durması). Logo görseli hâlâ splash ekranı, waitlist
 * sayfası ve share card export'unda (lib/share/*) kullanılıyor.
 * OS etiketi: brand color (turuncu) ile vurgulanır (premium hissi).
 */

import { BRAND } from "@/lib/brand";

interface Props {
  /** Compact: sadece logo + isim. Default: false → tagline da var */
  compact?: boolean;
}

export function BrandHeader({ compact = false }: Props): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col leading-tight">
        <div className="flex items-baseline gap-1">
          <span className="text-text-t1 font-mono text-sm font-semibold tracking-widest">
            {BRAND.name}
          </span>
          <span className="text-brand font-mono text-2xs font-bold tracking-widest">
            {BRAND.system}
          </span>
          <span className="text-text-t3 font-mono text-2xs font-semibold tracking-widest">
            {BRAND.version}
          </span>
        </div>
        {!compact && (
          <span className="text-text-t3 font-mono text-2xs tracking-wider">
            {BRAND.taglineShort}
          </span>
        )}
      </div>
    </div>
  );
}
