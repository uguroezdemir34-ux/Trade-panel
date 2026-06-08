"use client";

import { useState, useEffect } from "react";

export function useAuthStub() {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => { setIsLoaded(true); }, []);
  return { userId: null as string | null, isLoaded };
}

export function useUserStub() {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => { setIsLoaded(true); }, []);
  return { user: null as null, isLoaded };
}
