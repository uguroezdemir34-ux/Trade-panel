"use client";

import { SignIn } from "@clerk/nextjs";
import { clerkDarkAppearance } from "@/lib/auth/clerkAppearance";
import { CLERK_CONFIGURED } from "@/lib/auth/ClerkClientWrapper";

/**
 * Catch-all route ([[...sign-in]]) — Clerk'in çok adımlı akışları (MFA,
 * SSO callback, şifre sıfırlama) `routing="path"` ile /sign-in/<adım>
 * alt-path'lerine kendi kendine navigate ediyor. Önceki sürüm sade bir
 * page.tsx + routing="virtual" kullanıyordu (URL hiç değişmiyordu) — bu,
 * Clerk'in kendi dokümante ettiği standart App Router deseni değil ve
 * bazı akışlarda (özellikle SSO redirect dönüşü) 404'e yol açabiliyordu.
 */
export default function SignInPage() {
  // CLERK_CONFIGURED false ise ClerkClientWrapper <ClerkProvider>'ı hiç
  // render etmiyor — <SignIn> context'siz kalıp sessizce boş render
  // olurdu (bug taramasında bulunan "boş /sign-in" semptomunun kanıtı
  // ClerkClientWrapper.tsx'teki console.error'da görünür). Burada da
  // görünür bir mesaj göster, sessiz boş ekran bırakma.
  if (!CLERK_CONFIGURED) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg px-4 text-center">
        <p className="font-mono text-sm text-red-400">⚠ Giriş sistemi yapılandırılmamış</p>
        <p className="font-mono text-xs text-text-t3">
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY eksik veya build sırasında geçerli değildi.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={clerkDarkAppearance}
      />
    </div>
  );
}
