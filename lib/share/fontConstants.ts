/**
 * PAYLAŞILAN FONT SABİTİ — bağımlılıksız, tarayıcı+sunucu ikisinde de
 * güvenle import edilebilir.
 *
 * BİLEREK lib/share/fonts.ts'ten AYRI: fonts.ts, @napi-rs/canvas (native,
 * sadece Node/sunucu binary'si) import ediyor — renderShareCard.ts hem
 * tarayıcıda (exportShareCard.ts) hem sunucuda (exportShareCardServer.ts)
 * kullanıldığı için, CARD_FONT_FAMILY'yi fonts.ts'ten alması @napi-rs/canvas'ı
 * tarayıcı bundle'ına sızdırırdı (build kırılması/gereksiz native kod riski).
 * Bu dosya sıfır import taşıyor — hiçbir bundle'a yan etki bulaştırmaz.
 */
export const CARD_FONT_FAMILY = "IBM Plex Mono";
