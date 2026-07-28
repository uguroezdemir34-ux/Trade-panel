"use client";

import Image from "next/image";
import quantixLogo from "@/public/quantix-logo.png";

interface Props {
  size?: "sm" | "md" | "lg";
  alt?: string;
  className?: string;
  /** Siyah arka planda beyaz bg'yi kaldırır (splash için) */
  blend?: boolean;
}

const SIZES = { sm: 20, md: 40, lg: 120 } as const;

export function QuantixLogo({
  size = "md",
  alt = "QUANTIX",
  className = "",
  blend = false,
}: Props): React.ReactElement {
  const px = SIZES[size];
  return (
    <Image
      src={quantixLogo}
      alt={alt}
      width={px}
      height={px}
      // Sadece "sm" (BrandHeader — tek kullanım yeri, header'da her
      // sayfada üstte) LCP önceliği alıyor; "lg" (splash/waitlist)
      // kasıtlı hariç — birden fazla görseli priority işaretlemek
      // sinyali sulandırır.
      priority={size === "sm"}
      className={`inline-block rounded-full ${className}`}
      style={{
        width: px,
        height: px,
        mixBlendMode: blend ? "screen" : undefined,
      }}
    />
  );
}
