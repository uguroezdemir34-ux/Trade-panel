"use client";

import { SignUp } from "@clerk/nextjs";
import { getClerkAppearance } from "@/lib/auth/clerkAppearance";
import { CLERK_CONFIGURED } from "@/lib/auth/ClerkClientWrapper";
import { isNativePlatform } from "@/lib/mobile/platform";

/**
 * Bkz. app/sign-in/[[...sign-in]]/page.tsx dosya başı yorumu — aynı gerekçe.
 * CLERK_CONFIGURED kontrolü de aynı sebeple (sessiz boş ekran yerine görünür
 * mesaj) — o dosyadaki yorum bu değişikliğin tam gerekçesini açıklıyor.
 */
export default function SignUpPage() {
  if (!CLERK_CONFIGURED) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg px-4 text-center">
        <p className="font-mono text-sm text-red-400">⚠ Kayıt sistemi yapılandırılmamış</p>
        <p className="font-mono text-xs text-text-t3">
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY eksik veya build sırasında geçerli değildi.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        appearance={getClerkAppearance(isNativePlatform())}
      />
    </div>
  );
}
