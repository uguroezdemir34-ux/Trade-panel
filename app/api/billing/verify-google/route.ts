/**
 * POST /api/billing/verify-google — Google Play native abonelik satın alma
 * doğrulaması.
 *
 * Client tarafı: lib/billing/playBilling.ts'teki buySubscription() gerçek
 * purchaseToken/orderId'yi getLatestTransaction() ile aldıktan SONRA bu
 * route'a POST atar ({purchaseToken, productId}) — capacitor-native-
 * purchases plugin'inin kendi setGoogleVerificationDetails auto-callback
 * mekanizmasına BİLEREK güvenilmiyor: plugin'in native (Kotlin) tarafının
 * bu endpoint'e hangi request formatıyla POST attığı doğrulanamadı (native
 * kaynak koduna bu ortamdan erişilemedi) — bunun yerine tamamen kendi
 * kontrolümüzdeki, TypeScript tarafından açıkça çağrılan bir sözleşme
 * kuruldu. setGoogleVerificationDetails yine de çağrılıyor (bkz.
 * playBilling.ts) ama sonucuna bağımlı değiliz.
 *
 * Google Play Developer API (androidpublisher v3, purchases.subscriptions)
 * ile purchaseToken'ın gerçekten aktif/ödenmiş bir abonelik olduğu
 * doğrulanır, sonra Stripe webhook'uyla AYNI tier mekanizması kullanılır
 * (patchClerkPublicMetadata → plan: "pro") — iki ödeme kaynağı (Stripe/web,
 * Play Billing/Android) aynı Clerk plan alanını paylaşıyor, ayrı bir
 * "mobile tier" kavramı YOK.
 *
 * ACKNOWLEDGE ZORUNLU: Google, satın alma 3 gün içinde acknowledge
 * edilmezse OTOMATİK OLARAK İADE eder (resmi Play Billing kısıtı) — bu
 * yüzden doğrulama sırasında acknowledgementState kontrol edilip
 * gerekiyorsa hemen acknowledge çağrısı da yapılıyor.
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { auth } from "@/lib/auth/serverStubs";
import { patchClerkPublicMetadata } from "@/lib/clerk/metadata";

const PACKAGE_NAME = "com.quantixos.trading"; // bkz. capacitor.config.ts appId

interface VerifyRequestBody {
  purchaseToken?: string;
  productId?: string;
}

function getAndroidPublisher() {
  const rawJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!rawJson) return null;

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    console.error("[/api/billing/verify-google] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON geçersiz JSON");
    return null;
  }

  const authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  return google.androidpublisher({ version: "v3", auth: authClient });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: VerifyRequestBody;
  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { purchaseToken, productId } = body;
  if (!purchaseToken || !productId) {
    return NextResponse.json({ error: "purchaseToken and productId required" }, { status: 400 });
  }

  const publisher = getAndroidPublisher();
  if (!publisher) {
    return NextResponse.json({ error: "Google Play verification not configured" }, { status: 503 });
  }

  try {
    const { data: subscription } = await publisher.purchases.subscriptions.get({
      packageName: PACKAGE_NAME,
      subscriptionId: productId,
      token: purchaseToken,
    });

    const expiryMs = subscription.expiryTimeMillis ? Number(subscription.expiryTimeMillis) : 0;
    const isActive = expiryMs > Date.now();
    // paymentState: 0=pending, 1=received, 2=free trial, 3=pending deferred upgrade/downgrade
    const isPaid = subscription.paymentState === 1 || subscription.paymentState === 2;

    if (!isActive || !isPaid) {
      return NextResponse.json({ verified: false, active: false });
    }

    if (subscription.acknowledgementState === 0) {
      await publisher.purchases.subscriptions.acknowledge({
        packageName: PACKAGE_NAME,
        subscriptionId: productId,
        token: purchaseToken,
      });
    }

    await patchClerkPublicMetadata(userId, {
      plan: "pro",
      googlePurchaseToken: purchaseToken,
    });

    return NextResponse.json({ verified: true, active: true });
  } catch (err) {
    console.error("[/api/billing/verify-google]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
