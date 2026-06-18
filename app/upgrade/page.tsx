"use client";

export const dynamic = "force-dynamic";

import dynamic from "next/dynamic";

const UpgradeInner = dynamic(() => import("./_inner"), { ssr: false });

export default function UpgradePage() {
  return <UpgradeInner />;
}
