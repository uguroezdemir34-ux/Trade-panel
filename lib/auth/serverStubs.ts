// Server-side auth stubs — used when Clerk is not configured.
// Returns null userId so auth-gated routes respond with 401.

export async function auth() {
  return { userId: null as string | null };
}

export async function currentUser() {
  return null;
}
