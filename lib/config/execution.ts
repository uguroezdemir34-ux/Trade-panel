// Default false (signal mode). Set NEXT_PUBLIC_EXECUTION_MODE=LIVE only when
// live execution is intentionally enabled and security-reviewed.
export const EXECUTION_ENABLED =
  process.env.NEXT_PUBLIC_EXECUTION_MODE === "LIVE";
