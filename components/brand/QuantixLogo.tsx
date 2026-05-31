"use client";

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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/quantix-logo.png"
      alt={alt}
      width={px}
      height={px}
      className={`inline-block rounded-full ${className}`}
      style={{
        width: px,
        height: px,
        mixBlendMode: blend ? "screen" : undefined,
      }}
    />
  );
}
