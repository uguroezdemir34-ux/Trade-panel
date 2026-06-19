"use client";

import { ClerkProvider } from "@clerk/nextjs";

// Evaluated at build time (client bundle) so SSR and hydration always agree.
// Avoids server-runtime vs client-buildtime mismatch when layout.tsx (server
// component) checks process.env at request time but client bundle has it inlined.
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function ClerkClientWrapper({ children }: { children: React.ReactNode }) {
  if (!CLERK_KEY) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}
