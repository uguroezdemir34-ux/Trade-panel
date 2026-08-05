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
  // `dynamic` prop KRİTİK (05 Ağu 2026 — CSP enforce prod kırılması teşhisi):
  // @clerk/nextjs'in ClerkProvider'ı, script-src header'ımızdaki nonce'u
  // OTOMATİK olarak kendi Content-Security-Policy response header'ından
  // ayrıştırıp (getNonceFromCSPHeader, middleware.ts'in buildCsp() ürettiği
  // AYNI header'ı okuyor) clerk-js script tag'ine geçiren yerleşik bir
  // mekanizmaya sahip — AMA sadece `dynamic` true iken çalışıyor
  // (@clerk/nextjs ClerkProvider.js: generateNonce() dynamic yoksa boş
  // string döner). Bu satır olmadan clerk-js'in kendi script'i 'self'
  // olmadığı ve nonce'suz olduğu için strict-dynamic zincirine hiç
  // giremiyordu — DevTools'ta doğrulandı: "Loading the script
  // native-lynx-21.clerk.accounts.dev/.../clerk-js... violates script-src".
  // Manuel nonce prop'u geçmeye gerek yok, Clerk kendi header'ımızdan okuyor.
  return (
    <ClerkProvider dynamic>{children}</ClerkProvider>
  );
}
