"use client";

export const dynamic = "force-dynamic";

import { SignUp } from "@clerk/nextjs";
import { clerkDarkAppearance } from "@/lib/auth/clerkAppearance";

/** Bkz. app/sign-in/[[...sign-in]]/page.tsx dosya başı yorumu — aynı gerekçe. */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        appearance={clerkDarkAppearance}
      />
    </div>
  );
}
