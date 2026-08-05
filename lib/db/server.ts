/**
 * SUPABASE SERVER CLIENT — REST API helper (no SDK, no npm install needed).
 *
 * Uses the Supabase PostgREST REST API directly via fetch.
 * The service role key is ONLY used server-side (Next.js route handlers).
 * Never import this from a "use client" component.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function assertConfig(): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
}

function baseHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Build a PostgREST URL for the given table and query string */
function tableUrl(table: string, query = ""): string {
  const base = `${SUPABASE_URL}/rest/v1/${table}`;
  return query ? `${base}?${query}` : base;
}

/**
 * SELECT — fetch rows matching the given query.
 * @example dbSelect("trades", "user_id=eq.user_123&order=opened_at.desc")
 */
export async function dbSelect<T>(table: string, query: string): Promise<T[]> {
  assertConfig();
  const res = await fetch(tableUrl(table, query), {
    method: "GET",
    headers: { ...baseHeaders(), Accept: "application/json" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase SELECT failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<T[]>;
}

/**
 * UPSERT — insert or update rows. Uses `id` (the table's primary key) as
 * the conflict key by default. Safe to call multiple times (idempotent).
 *
 * @param onConflict Alternate conflict-target column (must have a UNIQUE
 *   or PK constraint in Postgres) — for tables where the caller doesn't
 *   supply the PK itself (e.g. a server-generated `id` default), so the
 *   natural key (an `endpoint`/`token`-style unique column) must be named
 *   explicitly for PostgREST to detect an existing row.
 */
export async function dbUpsert<T extends object>(
  table: string,
  rows: T | T[],
  onConflict?: string,
): Promise<void> {
  assertConfig();
  const body = Array.isArray(rows) ? rows : [rows];
  const query = onConflict ? `on_conflict=${onConflict}` : "";
  const res = await fetch(tableUrl(table, query), {
    method: "POST",
    headers: {
      ...baseHeaders(),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase UPSERT failed (${res.status}): ${err}`);
  }
}

/**
 * UPDATE — partial-column update on rows matching the given query. Unlike
 * dbUpsert (INSERT ... ON CONFLICT), this is a genuine SQL UPDATE — safe to
 * call with a subset of columns even when other NOT NULL columns (without a
 * DEFAULT) exist on the table, since no candidate INSERT row is ever built.
 * @example dbUpdate("waitlist", { status: "approved" }, "email=eq.foo@bar.com")
 */
export async function dbUpdate<T extends object>(
  table: string,
  patch: Partial<T>,
  query: string,
): Promise<void> {
  assertConfig();
  const res = await fetch(tableUrl(table, query), {
    method: "PATCH",
    headers: { ...baseHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase UPDATE failed (${res.status}): ${err}`);
  }
}

/**
 * DELETE — delete rows matching the given query.
 * @example dbDelete("trades", "user_id=eq.user_123&status=eq.pending")
 */
export async function dbDelete(table: string, query: string): Promise<void> {
  assertConfig();
  const res = await fetch(tableUrl(table, query), {
    method: "DELETE",
    headers: baseHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase DELETE failed (${res.status}): ${err}`);
  }
}

/** True if Supabase is configured in this environment */
export function isDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

/**
 * RPC — call a Postgres function via PostgREST (`/rest/v1/rpc/{fn}`).
 * Used when multiple writes need to happen atomically (a Postgres function
 * body is a single transaction) — plain dbSelect/dbUpsert/dbUpdate calls
 * are separate REST requests, NOT atomic across each other.
 * @example dbRpc("process_nowpayments_ipn", { p_event_id: "...", ... })
 */
export async function dbRpc<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  assertConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase RPC ${fn} failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<T>;
}
