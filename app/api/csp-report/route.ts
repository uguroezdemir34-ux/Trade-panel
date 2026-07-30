/**
 * POST /api/csp-report — CSP Report-Only ihlal toplama endpoint'i.
 *
 * middleware.ts'teki Content-Security-Policy-Report-Only header'ının
 * report-uri/report-to hedefi. CSP hâlâ report-only — bu route hiçbir
 * şeyi BLOKLAMIYOR, sadece daha önce sadece tarayıcı console'unda kaybolan
 * ihlalleri Vercel function log'larında görünür kılıyor (enforce'a geçiş
 * öncesi ön koşul — bkz. middleware.ts REPORT-ONLY MOD yorumu).
 *
 * İki farklı body formatı destekleniyor (tarayıcıya göre değişir):
 *   - Legacy (report-uri direktifi, Firefox/Safari hâlâ bunu kullanıyor):
 *     Content-Type: application/csp-report
 *     Body: { "csp-report": { "document-uri", "violated-directive", "blocked-uri", ... } }
 *   - Reporting API (report-to direktifi + Reporting-Endpoints header, Chrome):
 *     Content-Type: application/reports+json
 *     Body: [{ "type": "csp-violation", "body": { "documentURL", "effectiveDirective", "blockedURL", ... }, ... }]
 *
 * Sadece console.error ile loglanıyor — DB'ye yazma YOK, rate-limit YOK
 * (kullanıcı kararı: bu sadece teşhis amaçlı bir ön koşul, gerçek hacim
 * görülürse ayrı bir iş olarak ele alınır).
 */

import { NextResponse } from "next/server";

interface LegacyCspReportBody {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "blocked-uri"?: string;
    "effective-directive"?: string;
    disposition?: string;
    referrer?: string;
  };
}

interface ReportingApiEntry {
  type?: string;
  body?: {
    documentURL?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    disposition?: string;
    referrer?: string;
  };
}

function logLegacyReport(parsed: LegacyCspReportBody): void {
  const report = parsed["csp-report"];
  if (!report) return;
  console.error("[CSP Report-Only ihlali — legacy report-uri]", {
    violatedDirective: report["violated-directive"],
    blockedUri: report["blocked-uri"],
    documentUri: report["document-uri"],
    disposition: report["disposition"],
    referrer: report["referrer"],
    timestamp: new Date().toISOString(),
  });
}

function logReportingApiEntries(entries: ReportingApiEntry[]): void {
  for (const entry of entries) {
    if (entry.type !== "csp-violation") continue;
    const b = entry.body ?? {};
    console.error("[CSP Report-Only ihlali — Reporting API]", {
      violatedDirective: b.effectiveDirective,
      blockedUri: b.blockedURL,
      documentUri: b.documentURL,
      disposition: b.disposition,
      referrer: b.referrer,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const raw = await req.text();
    if (!raw) return new NextResponse(null, { status: 204 });

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/reports+json")) {
      logReportingApiEntries(JSON.parse(raw) as ReportingApiEntry[]);
    } else {
      // application/csp-report (legacy) — varsayılan dal, bazı tarayıcılar
      // Content-Type'ı eksik/farklı gönderebiliyor, JSON şekli zaten
      // "csp-report" alanının varlığıyla ayırt ediliyor (logLegacyReport
      // report yoksa no-op).
      logLegacyReport(JSON.parse(raw) as LegacyCspReportBody);
    }
  } catch (err) {
    console.error("[CSP Report] body parse hatası:", err);
  }

  return new NextResponse(null, { status: 204 });
}
