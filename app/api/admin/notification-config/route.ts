/**
 * GET/POST /api/admin/notification-config — admin-only, Telegram bot
 * token/chat ID'lerini Supabase'de (AES-256-GCM şifreli, bkz.
 * lib/crypto/serverSecrets.ts) yönetir. middleware.ts'teki
 * isAdminApiRoute ("/api/admin(.*)") bu route'u zaten Edge seviyesinde
 * koruyor, buradaki kontrol app/api/admin/waitlist/route.ts ile aynı
 * ikinci savunma katmanı.
 *
 * GET sadece "yapılandırıldı mı" boolean'larını döner, ŞİFRELİ DE OLSA
 * gerçek değeri HİÇBİR ZAMAN geri döndürmez — mevcut OKX/Telegram Layer 2
 * kartlarındaki write-only pratikle aynı (kullanıcı kararı).
 *
 * POST kısmi günceleme kabul eder — body'de gelen ve boş olmayan alanlar
 * şifrelenip kaydedilir, gönderilmeyen/boş alanlar mevcut DB değerine
 * dokunmaz (tek tek alan güncellemesine izin verir, hepsini yeniden
 * girmeye gerek yok).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { isAdminUserId } from "@/lib/auth/admin";
import { getNotificationConfigRow, saveNotificationConfigRow } from "@/lib/db/notificationConfig";
import { encryptSecret } from "@/lib/crypto/serverSecrets";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!isAdminUserId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await getNotificationConfigRow();
  return NextResponse.json({
    telegramBotToken: !!row?.telegram_bot_token_enc,
    telegramVipChatId: !!row?.telegram_vip_chat_id_enc,
    telegramPublicChatId: !!row?.telegram_public_chat_id_enc,
  });
}

interface PostBody {
  telegramBotToken?: string;
  telegramVipChatId?: string;
  telegramPublicChatId?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!isAdminUserId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const patch: Record<string, string> = {};
    if (body.telegramBotToken?.trim()) {
      patch.telegram_bot_token_enc = encryptSecret(body.telegramBotToken.trim());
    }
    if (body.telegramVipChatId?.trim()) {
      patch.telegram_vip_chat_id_enc = encryptSecret(body.telegramVipChatId.trim());
    }
    if (body.telegramPublicChatId?.trim()) {
      patch.telegram_public_chat_id_enc = encryptSecret(body.telegramPublicChatId.trim());
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields provided" }, { status: 400 });
    }

    await saveNotificationConfigRow(patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/admin/notification-config] save failed:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
