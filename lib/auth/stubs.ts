"use client";

// When Clerk is configured (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set at build time),
// delegate to Clerk's hooks. When not configured, return safe no-op values.
// Function is selected once at module load — Rules of Hooks are satisfied because
// a given build always executes the same branch.

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function useAuthNoOp() {
  return { userId: null as string | null, isLoaded: true as boolean };
}

function useUserNoOp() {
  return { user: null as null, isLoaded: true as boolean };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _useAuth: () => { userId: any; isLoaded: boolean };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _useUser: () => { user: any; isLoaded: boolean };

if (CLERK_KEY) {
  // Clerk IS configured — import hooks (requires ClerkProvider in tree)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require("@clerk/nextjs");
  _useAuth = clerk.useAuth;
  _useUser = clerk.useUser;
} else {
  _useAuth = useAuthNoOp;
  _useUser = useUserNoOp;
}

export function useAuthStub() {
  const { userId, isLoaded } = _useAuth();
  return { userId: (userId ?? null) as string | null, isLoaded };
}

export function useUserStub() {
  const { user, isLoaded } = _useUser();
  return { user: user ?? null, isLoaded };
}
