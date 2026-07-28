import type { Metadata } from "next";

// page.tsx "use client" — metadata sadece Server Component'te çalışıyor,
// bu yüzden bu ayrı layout üzerinden taşınıyor (Next.js'in resmi deseni).
export const metadata: Metadata = {
  title: "Giriş Yap — QUANTIX OS",
  description: "QUANTIX OS hesabınıza giriş yapın.",
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
