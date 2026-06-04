"use client";

import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignUpPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <div className="font-mono text-2xl font-bold tracking-widest text-text-t1">
          QUANTIX <span className="text-brand">OS</span>
        </div>
        <p className="text-text-t3 font-mono text-xs tracking-wider mt-1">
          Advanced AI Trading Systems
        </p>
      </div>
      <SignUp
        appearance={{
          baseTheme: dark,
          variables: {
            colorBackground: "#111111",
            colorPrimary: "#C35523",
            colorText: "#E5E5E5",
            colorTextSecondary: "#888888",
            colorInputBackground: "#1A1A1A",
            colorInputText: "#E5E5E5",
            borderRadius: "8px",
            fontFamily: "'IBM Plex Mono', monospace",
          },
          elements: {
            card: "shadow-2xl border border-border",
            headerTitle: "font-mono tracking-wider",
            formButtonPrimary: "bg-brand hover:bg-brand/90 font-mono tracking-widest",
          },
        }}
      />
    </div>
  );
}
