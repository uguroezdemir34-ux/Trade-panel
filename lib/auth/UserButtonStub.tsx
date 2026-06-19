"use client";

import { UserButton as ClerkUserButton } from "@clerk/nextjs";

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Static import ensures same webpack module instance as ClerkClientWrapper,
// so UserButton shares the same ClerkProvider context.
const UserButtonImpl: React.ComponentType<{ afterSignOutUrl?: string }> | null =
  CLERK_KEY ? ClerkUserButton : null;

export function UserButtonStub({ afterSignOutUrl }: { afterSignOutUrl?: string }) {
  if (!UserButtonImpl) return null;
  const UB = UserButtonImpl;
  return <UB afterSignOutUrl={afterSignOutUrl} />;
}
