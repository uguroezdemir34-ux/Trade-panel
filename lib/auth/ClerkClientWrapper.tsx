"use client";

import { ClerkProvider } from "@clerk/nextjs";

// Evaluated at build time (client bundle) so SSR and hydration always agree.
// Avoids server-runtime vs client-buildtime mismatch when layout.tsx (server
// component) checks process.env at request time but client bundle has it inlined.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * lib/auth/stubs.ts (useAuthStub/useUserStub) bu bayrağı zaten örtük olarak
 * kullanıyordu (kendi CLERK_KEY kopyasıyla) — burada export edilip paylaşılıyor
 * ki app/sign-in, app/sign-up gibi Clerk component'ini DOĞRUDAN import eden
 * sayfalar da (stub'suz, doğrudan <SignIn>/<SignUp>) aynı kontrolü yapabilsin.
 */
export const CLERK_CONFIGURED = Boolean(CLERK_KEY);

export function ClerkClientWrapper({ children }: { children: React.ReactNode }) {
  if (!CLERK_CONFIGURED) {
    // Sessizce children'ı Provider'sız render etmek, /sign-in gibi Clerk
    // component'ini DOĞRUDAN kullanan sayfalarda hiçbir hata/log bırakmadan
    // boş bir ekrana yol açıyordu (bug taramasında bulundu — DevTools'suz
    // teşhis edilemeyen bir "sessizce yanlış" durumu). Artık en azından
    // Console'da net bir iz bırakıyor.
    console.error(
      "[ClerkClientWrapper] NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY eksik (build zamanında) —" +
        " ClerkProvider render edilmedi. Clerk component'i doğrudan kullanan sayfalar" +
        " (örn. /sign-in, /sign-up) boş kalabilir. Vercel → Settings → Environment" +
        " Variables'ta bu değişkenin Production scope'unda gerçekten set olduğunu kontrol et.",
    );
    return <>{children}</>;
  }
  return <ClerkProvider>{children}</ClerkProvider>;
}
