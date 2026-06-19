"use client";

import { useAuth as clerkUseAuth, useUser as clerkUseUser } from "@clerk/nextjs";

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function useAuthNoOp() {
  return { userId: null as string | null, isLoaded: true as boolean };
}

function useUserNoOp() {
  return { user: null as null, isLoaded: true as boolean };
}

// CLERK_KEY is inlined at build time — webpack dead-code-eliminates the unused
// branch, so useAuthImpl/useUserImpl are fixed per build. Rules of Hooks satisfied.
const useAuthImpl = CLERK_KEY ? clerkUseAuth : useAuthNoOp;
const useUserImpl = CLERK_KEY ? clerkUseUser : useUserNoOp;

export function useAuthStub() {
  const { userId, isLoaded } = useAuthImpl();
  return { userId: (userId ?? null) as string | null, isLoaded };
}

export function useUserStub() {
  const { user, isLoaded } = useUserImpl();
  return { user: user ?? null, isLoaded };
}
