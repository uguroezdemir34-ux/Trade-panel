/**
 * POST /api/admin/waitlist/approve — { email } — waitlist kaydını onaylar,
 * mümkünse Clerk betaAccess'i anında set eder (bkz. lib/waitlist/approve.ts).
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/serverStubs";
import { isAdminUserId } from "@/lib/auth/admin";
import { approveWaitlistEmail } from "@/lib/waitlist/approve";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!isAdminUserId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  try {
    const result = await approveWaitlistEmail(email);
    if (!result.ok) {
      return NextResponse.json({ error: "Email not found in waitlist" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/admin/waitlist/approve]", err);
    return NextResponse.json({ error: "Approval failed" }, { status: 500 });
  }
}
