"use client";

import { useAuth, useUser } from "@clerk/nextjs";

export function useAuthStub() {
  const { userId, isLoaded } = useAuth();
  return { userId: userId ?? null, isLoaded };
}

export function useUserStub() {
  const { user, isLoaded } = useUser();
  return { user: user ?? null, isLoaded };
}
