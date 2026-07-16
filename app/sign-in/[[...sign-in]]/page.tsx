"use client";

export const dynamic = "force-dynamic";

import { SignIn } from "@clerk/nextjs";
import { clerkDarkAppearance } from "@/lib/auth/clerkAppearance";

/**
 * Catch-all route ([[...sign-in]]) — Clerk'in çok adımlı akışları (MFA,
 * SSO callback, şifre sıfırlama) `routing="path"` ile /sign-in/<adım>
 * alt-path'lerine kendi kendine navigate ediyor. Önceki sürüm sade bir
 * page.tsx + routing="virtual" kullanıyordu (URL hiç değişmiyordu) — bu,
 * Clerk'in kendi dokümante ettiği standart App Router deseni değil ve
 * bazı akışlarda (özellikle SSO redirect dönüşü) 404'e yol açabiliyordu.
 */
export default function SignInPage() {
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
