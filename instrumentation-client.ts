import * as Sentry from "@sentry/nextjs";

// tracesSampleRate ve enableLogs bilerek kaldırıldı — ikisi de otomatik
// olarak browserTracingIntegration + logs-capture entegrasyonunu dahil
// ediyordu (bundle-analyze CI'da ölçüldü: paylaşılan chunk'ın @sentry/*
// payının önemli kısmı), ve kod tabanında ne Sentry.startSpan ne
// Sentry.logger hiç çağrılmıyor — sadece dashboard-only telemetri,
// hata yakalama (GlobalHandlers/TryCatch/Breadcrumbs) bundan etkilenmez.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Session Replay init'ten kasıtlı olarak çıkarıldı — bu dosyanın en üstündeki
// "import * as Sentry" statik olduğu için, replayIntegration()'ı burada
// çağırmak (integrations: [] içinde ya da sonradan) Replay'in kodunu
// (@sentry/replay + bağımlılıkları) her sayfanın ilk yüküne dahil ederdi.
//
// İlk versiyon await import("@sentry/nextjs") kullanıyordu — bundle
// analiziyle (CI, bundle-analyze.yml) bunun işe yaramadığı, Replay'in
// paylaşılan chunk'ta değişmeden kaldığı VE ayrı bir chunk'ta ikinci bir
// kopyasının oluştuğu ölçüldü. Kök neden zinciri (node_modules'ta
// doğrudan okunarak doğrulandı): @sentry/nextjs → "export * from
// '@sentry/react'" → "export * from '@sentry/browser'" — iki ardışık
// wildcard re-export, statik namespace import ("import * as Sentry")
// ile birleşince tree-shaking'i güvenilmez kılıyor; dinamik import de
// aynı barrel'ı hedeflediği için bu zinciri atlamıyor. @sentry/browser
// katmanının kendisi replayIntegration'ı SARMALAMIYOR — doğrudan
// "export { replayIntegration } from '@sentry/replay'" ile, isimlendirilmiş
// (tree-shake edilebilir) bir re-export olarak devrediyor; yani
// @sentry/replay gerçek kaynak, aradaki iki paket sadece geçit. Bu yüzden
// doğrudan @sentry/replay'den import ediyoruz — üç ara barrel'ı da
// (nextjs/react/browser) atlıyor, işlevsellik kaybı riski yok (aynı
// fonksiyon, hiç sarmalanmamış).
let replayLoaded = false;

export async function loadSentryReplay(): Promise<void> {
  if (replayLoaded) return;
  replayLoaded = true;
  const { replayIntegration } = await import("@sentry/replay");
  Sentry.addIntegration(replayIntegration());
}
