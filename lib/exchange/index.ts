// Stub — EXECUTION_ENABLED=false (signal mode) while this file exists only
// for webpack module resolution. getAdapter is unreachable when execution
// is disabled because all call sites guard with an early return first.
// Set NEXT_PUBLIC_EXECUTION_MODE=LIVE only after full security review.

export interface ExchangeAdapter {
  openPosition(params: {
    pair: string;
    direction: "LONG" | "SHORT";
    qty: number;
    leverage: number;
    marginMode: string;
    slPrice?: number;
  }): Promise<{
    ok: boolean;
    data?: { orderId?: string };
    errorMessage?: string;
  }>;
}

export function getAdapter(_demoMode: boolean): ExchangeAdapter {
  throw new Error(
    "Exchange execution not enabled (signal mode). " +
    "Set NEXT_PUBLIC_EXECUTION_MODE=LIVE only after security review.",
  );
}
