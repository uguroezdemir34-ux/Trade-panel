"use client";

export const dynamic = "force-dynamic";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <SignIn routing="virtual" />
    </div>
  );
}
