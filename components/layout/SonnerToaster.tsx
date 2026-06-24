"use client";
import { Toaster } from "sonner";

export function SonnerToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      duration={2000}
    />
  );
}
