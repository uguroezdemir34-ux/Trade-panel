import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * [BETA-DEBUG] GEÇİCİ TEŞHİS ENDPOINT'İ — betaAccess'in sessionClaims'e
 * (Edge middleware'in gördüğü JWT claim) gerçekten ulaşıp ulaşmadığını,
 * Clerk'in canlı frontend API'sinden okunan currentUser().publicMetadata
 * ile yan yana karşılaştırmak için. Giriş yapılmış olmayı gerektirir
 * (middleware.ts'teki isPublicRoute listesinde YOK). Kaynak teşhis
 * edildikten sonra bu route silinecek.
 */
export async function GET() {
  const { userId, sessionClaims } = await auth();
  const user = userId ? await currentUser() : null;

  return NextResponse.json({
    userId,
    sessionClaims,
    sessionClaimsPublicMetadata:
      (sessionClaims as { publicMetadata?: unknown } | undefined)?.publicMetadata ?? null,
    userPublicMetadata: user?.publicMetadata ?? null,
  });
}
