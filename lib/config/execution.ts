/**
 * EXECUTION CONFIG — Global execution kill switch.
 *
 * false: Uygulama sinyal/analiz/bildirim modunda çalışır.
 *        Hiçbir borsa emri gönderilmez (openPosition, closePosition, updateSlTp).
 *        Copy trading borsanın master-trader motoruna devredilmiştir.
 *
 * true:  Tam otomatik execution aktif (bot modu, emergency stop, trailing stop).
 *        Yalnızca web deployment'ta manuel olarak true yapılmalı.
 */
export const EXECUTION_ENABLED = false as const;
