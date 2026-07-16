/**
 * CLERK APPEARANCE — QUANTIX OS'un koyu/turuncu/mavi temasına uyan ortak
 * `<SignIn/>`/`<SignUp/>` görünüm konfigürasyonu.
 *
 * `variables` — Clerk'in kendi ürettiği iç elementler (odak halkaları, ikon
 * renkleri vb.) için ham hex değerleri (app/globals.css'teki --bg/--brand/
 * --text-t1 CSS değişkenleriyle AYNI, elle senkron tutulmalı — Tailwind
 * class'ları buraya giremiyor çünkü Clerk bu değerleri kendi iç SVG/stil
 * hesaplarında kullanıyor).
 * `elements` — asıl kart/buton/input yapısı için Tailwind class'ları
 * (tema değişirse CSS değişkenleri üzerinden otomatik güncellenir).
 */

const appearanceVariables = {
  colorPrimary: "#ff6e18", // --brand
  colorBackground: "#0a0c12", // --bg
  colorInputBackground: "#0f121c", // --bg-card
  colorInputText: "#e8eaf4", // --text-t1
  colorText: "#e8eaf4", // --text-t1
  colorTextSecondary: "#a4a8c2", // --text-t2
  colorDanger: "#c76069", // --signal-red
  colorSuccess: "#388961", // --signal-green
  colorWarning: "#a67530", // --signal-amber
  borderRadius: "0.5rem",
};

const appearanceElements = {
  rootBox: "w-full",
  card: "bg-bg-card border border-border shadow-2xl rounded-lg",
  headerTitle: "text-text-t1 font-mono",
  headerSubtitle: "text-text-t3 font-mono text-xs",
  socialButtonsBlockButton:
    "border border-border text-text-t1 hover:bg-bg-hover font-mono text-xs",
  socialButtonsBlockButtonText: "font-mono text-xs",
  dividerLine: "bg-border",
  dividerText: "text-text-t4 font-mono text-2xs",
  formFieldLabel: "text-text-t2 font-mono text-xs",
  formFieldInput: "bg-bg border border-border text-text-t1 focus:border-brand",
  formButtonPrimary:
    "bg-brand hover:bg-brand-light text-white font-mono text-xs tracking-wider normal-case",
  footerActionText: "text-text-t3 font-mono text-xs",
  footerActionLink: "text-brand hover:text-brand-light font-mono text-xs",
  identityPreviewText: "text-text-t2 font-mono text-xs",
  identityPreviewEditButton: "text-brand",
  formResendCodeLink: "text-brand",
  otpCodeFieldInput: "bg-bg border border-border text-text-t1",
};

/** `<SignIn appearance={clerkDarkAppearance}/>` / `<SignUp appearance={clerkDarkAppearance}/>` */
export const clerkDarkAppearance = {
  variables: appearanceVariables,
  elements: appearanceElements,
};
