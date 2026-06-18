"use client";

// Mirrors the conditional pattern in stubs.ts:
// render UserButton only when ClerkProvider is in the tree (key set at build time).
// Direct import of UserButton from @clerk/nextjs bypasses this guard and throws.

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _UserButton: React.ComponentType<{ afterSignOutUrl?: string }> | null = null;

if (CLERK_KEY) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require("@clerk/nextjs");
  _UserButton = clerk.UserButton;
}

export function UserButtonStub({ afterSignOutUrl }: { afterSignOutUrl?: string }) {
  if (!_UserButton) return null;
  const UB = _UserButton;
  return <UB afterSignOutUrl={afterSignOutUrl} />;
}
