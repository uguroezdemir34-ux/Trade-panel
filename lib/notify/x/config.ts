/**
 * X (TWITTER) CONFIG — API key + access token okuma.
 *
 * Telegram'daki loadTelegramConfigFromEnv() ile AYNI "sessizce atla" felsefesi,
 * ama BİLEREK console.warn YOK — Telegram birincil/zaten-yapılandırılmış
 * kanal, X ise bu turda sadece altyapı (kullanıcı X Developer hesabından
 * gerçek key'leri alana kadar env değişkenleri tanımsız kalacak). Her saatlik
 * cron çalışmasında "X yapılandırılmamış" uyarısı loglamak gürültüden başka
 * bir şey katmaz — config===null dönüşü çağıran tarafta zaten sessizce
 * atlanıyor (bkz. app/api/cron/signal-check/route.ts).
 *
 * DB-öncelikli çözümleme (Telegram'daki resolveTelegramConfig() gibi)
 * BİLEREK yok — bu turun kapsamı sadece env-tabanlı altyapı, notification_config
 * tablosuna X alanları eklemek ayrı bir görev.
 */

export interface XConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

export function loadXConfigFromEnv(
  env: Record<string, string | undefined> = (typeof process !== "undefined" ? process.env : {}),
): XConfig | null {
  const apiKey = env.X_API_KEY?.trim();
  const apiSecret = env.X_API_SECRET?.trim();
  const accessToken = env.X_ACCESS_TOKEN?.trim();
  const accessSecret = env.X_ACCESS_SECRET?.trim();

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    return null;
  }
  return { apiKey, apiSecret, accessToken, accessSecret };
}
