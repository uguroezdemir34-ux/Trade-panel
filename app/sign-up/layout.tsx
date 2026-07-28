import type { Metadata } from "next";

// page.tsx "use client" — metadata sadece Server Component'te çalışıyor,
// bu yüzden bu ayrı layout üzerinden taşınıyor (Next.js'in resmi deseni).
export const metadata: Metadata = {
  title: "Kayıt Ol — QUANTIX OS",
  description: "QUANTIX OS için ücretsiz hesap oluşturun.",
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
