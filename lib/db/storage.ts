/**
 * SUPABASE STORAGE — sunucu tarafı dosya/görsel yükleme.
 *
 * lib/db/server.ts'teki AYNI REST deseni (SDK yok — @supabase/supabase-js
 * bu projede hiç bağımlılık değil —, doğrudan fetch, service role key).
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY sabitleri server.ts'te modül-
 * private (export edilmemiş) olduğu için buraya doğrudan import
 * edilemedi — aynı iki env değişkeni burada da okunuyor. Ama
 * "yapılandırılmış mı" kontrolü TEKRAR YAZILMADI — doğrudan
 * isDbConfigured() import edilip kullanılıyor (zaten aynı iki env var'a
 * bakıyor, ikinci bir versiyonu icat etmeye gerek yok).
 *
 * Best-effort — hiçbir zaman throw ETMEZ: yapılandırma eksikse veya
 * yükleme başarısız olursa null döner, ama sessizce yutmaz — her
 * durumda console.error/console.warn ile loglar (CLAUDE.md §0.1 madde 3:
 * emin değilse sessiz fallback yerine görünür durum).
 */

import { isDbConfigured } from "./server";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Bir dosyayı Supabase Storage'a yükler (upsert — aynı path'te varsa
 * üzerine yazar), başarılıysa public URL döner.
 *
 * @returns Yapılandırma eksikse veya yükleme (network/4xx/5xx) başarısız
 *   olursa null — çağıran taraf bunu "görsel yok" olarak ele almalı,
 *   ana akışı (cron) durdurmamalı.
 */
export async function uploadPublicImage(
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string,
): Promise<string | null> {
  if (!isDbConfigured()) {
    console.warn(
      `[storage] SUPABASE not configured — upload to ${bucket}/${path} skipped.` +
        ` Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env to enable uploads.`,
    );
    return null;
  }

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

  try {
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: data,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[storage] Upload failed (${res.status}) for ${bucket}/${path}: ${errText}`);
      return null;
    }
  } catch (err) {
    console.error(
      `[storage] Upload threw for ${bucket}/${path}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
