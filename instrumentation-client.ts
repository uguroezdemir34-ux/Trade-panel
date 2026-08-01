import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Session Replay init'ten kasıtlı olarak çıkarıldı — bu dosyanın en üstündeki
// "import * as Sentry" statik olduğu için, replayIntegration()'ı burada
// çağırmak (integrations: [] içinde ya da sonradan) Replay'in kodunu
// (@sentry/replay + bağımlılıkları) her sayfanın ilk yüküne dahil ederdi;
// tree-shaking bunu güvenilir şekilde ayıklayamıyor (Sentry'nin kendi
// dokümantasyonunun da önerdiği gibi gerçek bir dinamik import() gerekiyor).
// loadSentryReplay() bunu ayrı bir chunk'a böler, sadece çağrıldığında
// indirilir. Çağıran: lib/hooks/useSentryReplay.ts (AppShell'de mount
// edilir — AppShell public route'larda /sign-in, /sign-up vb. hiç render
// edilmediği için Replay o sayfaların bundle'ına hiç girmez).
let replayLoaded = false;

export async function loadSentryReplay(): Promise<void> {
  if (replayLoaded) return;
  replayLoaded = true;
  const { replayIntegration } = await import("@sentry/nextjs");
  Sentry.addIntegration(replayIntegration());
}
